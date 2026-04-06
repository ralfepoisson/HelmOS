import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HelpWidgetComponent } from './features/support/help-widget.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HelpWidgetComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
