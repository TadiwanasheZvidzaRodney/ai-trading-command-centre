'use client';

import type { CandleSeries } from '@atc/shared';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

function isIntraday(timeframe: CandleSeries['timeframe']): boolean {
  return ['1m', '5m', '15m', '30m', '1h', '4h'].includes(timeframe);
}

export function PriceChart({
  series,
  pricePrecision,
  tickSize,
}: {
  series: CandleSeries;
  pricePrecision: number;
  tickSize: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || series.candles.length === 0) return;

    let cancelled = false;
    let chart: IChartApi | null = null;
    let candleSeries: ISeriesApi<'Candlestick'> | null = null;
    let volumeSeries: ISeriesApi<'Histogram'> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function mount() {
      const { CandlestickSeries, HistogramSeries, createChart } = await import(
        'lightweight-charts'
      );
      if (cancelled || !container) return;

      chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight || 420,
        layout: {
          background: { color: 'transparent' },
          textColor: '#94a3b8',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        rightPriceScale: {
          borderColor: 'rgba(148, 163, 184, 0.18)',
        },
        timeScale: {
          borderColor: 'rgba(148, 163, 184, 0.18)',
          timeVisible: isIntraday(series.timeframe),
          secondsVisible: false,
          rightOffset: 4,
        },
        crosshair: {
          vertLine: { color: 'rgba(45, 212, 191, 0.5)', labelBackgroundColor: '#0f766e' },
          horzLine: { color: 'rgba(45, 212, 191, 0.5)', labelBackgroundColor: '#0f766e' },
        },
        localization: {
          priceFormatter: (price: number) => price.toFixed(pricePrecision),
        },
      });

      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        priceFormat: {
          type: 'price',
          precision: pricePrecision,
          minMove: tickSize,
        },
      });

      candleSeries.setData(
        series.candles.map((candle) => ({
          time: Math.floor(candle.time / 1000) as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })),
      );

      const volumeCandles = series.candles.filter((candle) => candle.volume !== null);
      if (volumeCandles.length > 0) {
        volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: '',
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
        });
        volumeSeries.setData(
          volumeCandles.map((candle) => ({
            time: Math.floor(candle.time / 1000) as UTCTimestamp,
            value: candle.volume ?? 0,
            color:
              candle.close >= candle.open
                ? 'rgba(34, 197, 94, 0.32)'
                : 'rgba(239, 68, 68, 0.32)',
          })),
        );
      }

      chart.timeScale().fitContent();

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chart) return;
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) {
          chart.applyOptions({ width, height: container.clientHeight || 420 });
        }
      });
      resizeObserver.observe(container);
    }

    void mount();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      volumeSeries = null;
      candleSeries = null;
      chart?.remove();
      chart = null;
    };
  }, [series, pricePrecision, tickSize]);

  if (series.candles.length === 0) {
    return (
      <div className="empty-state">
        <h3>No candles available</h3>
        <p>The provider returned an empty series. No synthetic candles were generated.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="price-chart"
      role="img"
      aria-label={`${series.instrument} ${series.timeframe} candlestick chart from ${series.from} to ${series.to}`}
    />
  );
}
