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
  templateUrl: './chart-panel.component.html',
  styleUrl: './chart-panel.component.css'
})
export class ChartPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() title = '';
  @Input() chartType: ChartType = 'pie';
  @Input() labels: string[] = [];
  @Input() datasets: ChartPanelDataset[] = [];

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

  private renderChart(): void {
    if (!this.chartCanvas?.nativeElement) {
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
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
}
