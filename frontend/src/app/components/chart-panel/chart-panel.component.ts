import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

export interface ChartPanelDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  fill?: boolean;
}

@Component({
  selector: 'app-chart-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-panel.component.html',
  styleUrl: './chart-panel.component.css'
})
export class ChartPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() title = '';
  @Input() chartType: ChartType = 'pie';
  @Input() labels: string[] = [];
  @Input() datasets: ChartPanelDataset[] = [];
  @Input() darkMode = false;
  @Input() emptyMessage = 'Keine Daten fuer diesen Zeitraum vorhanden.';

  private chart?: Chart;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  get showLegend(): boolean {
    return this.hasData() && (this.chartType === 'pie' || this.chartType === 'doughnut');
  }

  get legendItems(): Array<{ label: string; color: string }> {
    const colors = this.resolveLegendColors();
    return this.labels.map((label, index) => ({
      label,
      color: colors[index] ?? '#94a3b8'
    }));
  }

  private renderChart(): void {
    if (!this.chartCanvas?.nativeElement) {
      return;
    }

    if (!this.hasData()) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    this.chart?.destroy();

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: this.chartType,
      data: {
        labels: this.labels,
        datasets: this.datasets.map((dataset) => ({
          label: dataset.label,
          data: dataset.data,
          backgroundColor: dataset.backgroundColor,
          borderColor: dataset.borderColor,
          fill: dataset.fill ?? false,
          borderWidth: 2
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        color: this.darkMode ? '#cbd5e1' : '#475569',
        scales: this.chartType === 'bar'
          ? {
              x: {
                ticks: { color: this.darkMode ? '#cbd5e1' : '#475569' },
                grid: { color: this.darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)' }
              },
              y: {
                beginAtZero: true,
                ticks: { color: this.darkMode ? '#cbd5e1' : '#475569' },
                grid: { color: this.darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)' }
              }
            }
          : undefined,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: this.darkMode ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
            titleColor: this.darkMode ? '#f8fafc' : '#0f172a',
            bodyColor: this.darkMode ? '#e2e8f0' : '#334155',
            borderColor: this.darkMode ? 'rgba(71, 85, 105, 0.7)' : 'rgba(203, 213, 225, 0.8)',
            borderWidth: 1
          }
        }
      }
    });
  }

  hasData(): boolean {
    if (this.labels.length === 0) {
      return false;
    }

    return this.datasets.some((dataset) => dataset.data.length > 0);
  }

  private resolveLegendColors(): string[] {
    const primaryDataset = this.datasets[0];
    const backgroundColor = primaryDataset?.backgroundColor;

    if (Array.isArray(backgroundColor)) {
      return backgroundColor.map((color) => String(color));
    }

    if (typeof backgroundColor === 'string') {
      return this.labels.map(() => backgroundColor);
    }

    return [];
  }
}
