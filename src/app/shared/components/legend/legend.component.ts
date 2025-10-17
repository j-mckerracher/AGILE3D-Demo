/**
 * AGILE3D Object Class Legend Component
 *
 * Displays color-coded legend for object classifications in 3D viewers.
 * Uses CVD-safe colors with accessible labels.
 *
 * PRD References:
 * - FR-1.3: 3D bounding box color coding (Blue: Vehicles, Amber: Pedestrians, Green: Cyclists)
 * - NFR-3.5: WCAG 2.2 AA compliance
 * - UI-8.2: Consistent visual identity
 */

import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ViewerStyleAdapterService } from '../../../core/theme/viewer-style-adapter.service';
import { ObjectClassColor } from '../../../core/theme/theme.models';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface LegendItem {
  class: string;
  label: string;
  color: string;
  description: string;
  icon?: string;
}

@Component({
  selector: 'app-legend',
  standalone: true,
  imports: [CommonModule, MatChipsModule, MatIconModule],
  templateUrl: './legend.component.html',
  styleUrls: ['./legend.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegendComponent {
  /**
   * Display mode: 'horizontal' or 'vertical'
   */
  @Input() public layout: 'horizontal' | 'vertical' = 'horizontal';

  /**
   * Show icons alongside colors
   */
  @Input() public showIcons = false;

  /**
   * Show descriptions
   */
  @Input() public showDescriptions = false;

  /**
   * Custom title for the legend
   */
  @Input() public title = 'Object Classes';

  /**
   * Legend items observable
   */
  public readonly legendItems$: Observable<LegendItem[]>;

  constructor(private viewerStyleAdapter: ViewerStyleAdapterService) {
    this.legendItems$ = this.viewerStyleAdapter.viewerColors$.pipe(
      map(() => this.createLegendItems())
    );
  }

  /**
   * Create legend items from object class colors.
   */
  private createLegendItems(): LegendItem[] {
    const colors = this.viewerStyleAdapter.getAllObjectClassColors();

    return colors.map((colorInfo) => ({
      class: colorInfo.class,
      label: this.getLabel(colorInfo.class),
      color: colorInfo.hex,
      description: this.getDescription(colorInfo.class),
      icon: this.getIcon(colorInfo.class),
    }));
  }

  /**
   * Get human-readable label for object class.
   */
  private getLabel(objectClass: string): string {
    const labels: Record<string, string> = {
      vehicle: 'Vehicles',
      pedestrian: 'Pedestrians',
      cyclist: 'Cyclists',
    };
    return labels[objectClass] || objectClass;
  }

  /**
   * Get description for object class.
   */
  private getDescription(objectClass: string): string {
    const descriptions: Record<string, string> = {
      vehicle: 'Cars, trucks, and other motor vehicles',
      pedestrian: 'People walking or standing',
      cyclist: 'People riding bicycles or motorcycles',
    };
    return descriptions[objectClass] || '';
  }

  /**
   * Get icon for object class.
   */
  private getIcon(objectClass: string): string {
    const icons: Record<string, string> = {
      vehicle: 'directions_car',
      pedestrian: 'person',
      cyclist: 'pedal_bike',
    };
    return icons[objectClass] || 'circle';
  }

  /**
   * Get CSS class for layout.
   */
  public getLayoutClass(): string {
    return `legend-${this.layout}`;
  }
}
