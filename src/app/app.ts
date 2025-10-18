import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SkipLinkComponent } from './shared/components/skip-link/skip-link.component';
import { HeaderComponent } from './features/header/header.component';
import { HeroComponent } from './features/hero/hero.component';
import { FooterComponent } from './features/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SkipLinkComponent, HeaderComponent, HeroComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
