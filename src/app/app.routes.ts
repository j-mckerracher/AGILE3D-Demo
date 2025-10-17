import { Routes } from '@angular/router';
import { MainDemoComponent } from './features/main-demo/main-demo.component';

export const routes: Routes = [
  {
    path: '',
    component: MainDemoComponent,
    title: 'AGILE3D Interactive Demo',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
