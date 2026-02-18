import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { SharedModule } from '@app/shared/shared.module';
import { AddressTrackerComponent } from '@components/address-tracker/address-tracker.component';

const routes: Routes = [
  {
    path: ':id',
    component: AddressTrackerComponent,
    data: {
      ogImage: true
    }
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class AddressTrackerRoutingModule { }

@NgModule({
  imports: [
    CommonModule,
    AddressTrackerRoutingModule,
    SharedModule,
  ],
  declarations: [
    AddressTrackerComponent,
  ]
})
export class AddressTrackerModule { }