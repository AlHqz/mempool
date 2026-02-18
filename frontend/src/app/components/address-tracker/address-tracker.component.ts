import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, input } from '@angular/core';
import { StateService} from '@app/services/state.service';
import { ActivatedRoute, ParamMap, RouterModule } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { WebsocketService } from '@app/services/websocket.service';
import { switchMap, catchError } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { Address, Transaction } from '@interfaces/electrs.interface';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { EnterpriseService } from '@app/services/enterprise.service';

interface TransactionWithMeta extends Transaction {
  value?: number;
  blockTime?: number;
  type?: 'sent' | 'received';
  isConfirmed?: boolean;
}

@Component({
  selector: 'app-address-tracker',
  templateUrl: './address-tracker.component.html',
  styleUrls: ['./address-tracker.component.scss'],
  standalone: false
})
export class AddressTrackerComponent implements OnInit, OnDestroy {
  network = '';
  addressId: string;
  address: Address | null = null;
  transactions: TransactionWithMeta[] = [];
  isLoading = true;
  error: any = undefined;
  subscription: Subscription;
  enterpriseInfo$: Subscription;
  conversionsSubscription: Subscription;
  networkChangeSubscription: Subscription;
  enterpriseInfo: any;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    public stateService: StateService,
    private enterpriseService: EnterpriseService,
    private cd: ChangeDetectorRef,
    private websocketService: WebsocketService
  ) {}

  ngOnInit(): void {
    this.websocketService.want(['blocks']);
    
    this.enterpriseService.page();
    
    this.enterpriseInfo$ = this.enterpriseService.info$.subscribe(info => {
      this.enterpriseInfo = info;
      this.cd.markForCheck();
    });

    this.networkChangeSubscription = this.stateService.networkChanged$.subscribe(
      (network) => {
        this.network = network;
        this.cd.markForCheck();
      }
    );

    this.subscription = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.reset();
        this.addressId = params.get('id');
        if (!this.addressId) return of(null);
        return this.electrsApiService.getAddress$(this.addressId).pipe(
          catchError(err => {
            this.error = err;
            this.isLoading = false;
            this.cd.markForCheck();
            return of(null);
          })
        );
      })
    ).subscribe((address: Address | null) => {
      if (!address) {
        this.cd.markForCheck();
        return;
      }
      this.address = address;
      this.cd.markForCheck();
      this.loadTransactions();
    });
  }

  private loadTransactions(afterTxid?: string) {
    if (!this.addressId) return;
    this.isLoading = true;
    this.subscription.add(
      this.electrsApiService.getAddressTransactions$(this.addressId, afterTxid).pipe(
        catchError(err => {
          this.error = err;
          this.isLoading = false;
          this.cd.markForCheck();
          return of([] as Transaction[]);
        })
      ).subscribe((txs: Transaction[]) => {
        this.transactions = (txs || []).map(tx => this.enrichTransaction(tx));
        this.isLoading = false;
        this.cd.markForCheck();
      })
    );
  }

  private enrichTransaction(tx: Transaction): TransactionWithMeta {
    const t = tx as TransactionWithMeta;
    const totalreceived = tx.vout.reduce((sum, out) => sum + ((out.scriptpubkey_address === this.addressId) ? (out.value || 0) : 0), 0);
    const totalSent = tx.vin.reduce((sum, vin) => sum + ((vin.prevout?.scriptpubkey_address === this.addressId) ? (vin.prevout.value || 0) : 0), 0);
    const sent = tx.vin.some(v => v.prevout?.scriptpubkey_address === this.addressId);
    const received = tx.vout.some(v => v.scriptpubkey_address === this.addressId);
    
    if (sent) {
      t.type = 'sent';
      t.value = Math.max(0, totalSent - totalreceived);
    } else if (received && !sent) {
      t.type = 'received';
      t.value = totalreceived;
    }

    t.isConfirmed = !!tx.status?.confirmed;
    t.blockTime = tx.status?.block_time;
    return t;
  }

  get confirmedBalance(): number | undefined{
    if (!this.address) return;
    return this.address.chain_stats.funded_txo_sum - this.address.chain_stats.spent_txo_sum;
  }

  get pendingBalance(): number | undefined{
    if (!this.address) return;
    return this.address.mempool_stats.funded_txo_sum - this.address.mempool_stats.spent_txo_sum;
  }

  private reset() {
    this.address = null;
    this.transactions = [];
    this.isLoading = true;
    this.error = null;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.enterpriseInfo$?.unsubscribe();
    this.networkChangeSubscription?.unsubscribe();
  }
}
