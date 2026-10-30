'use client';

import type { CandleSeries, InstrumentSymbol, Timeframe } from '@atc/shared';
import type { TechnicalIndicators } from '@atc/technical-analysis';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

interface IndicatorToggles {
  sma20: boolean;
  sma50: boolean;
  ema9: boolean;
  rsi: boolean;
  macd: boolean;
  atr: boolean;
  bbands: boolean;
  stochastic: boolean;
}

interface DataPoint {
  time: UTCTimestamp;
  value: number;
}

function isIntraday(timeframe: Timeframe): boolean {
  return ['1m', '5m', '15m', '30m', '1h', '4h'].includes(timeframe);
}

export function ChartWithIndicators({
  series,
  technical,
  pricePrecision,
  tickSize,
}: {
  series: CandleSeries;
  technical: TechnicalIndicators | null;
  pricePrecision: number;
  tickSize: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [toggles, setToggles] = useState<IndicatorToggles>({
    sma20: true,
    sma50: true,
    ema9: true,
    rsi: true,
    macd: true,
    atr: true,
    bbands: true,
    stochastic: true,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || series.candles.length === 0 || !technical) return;

    let cancelled = false;
    let chart: IChartApi | null = null;
    let candleSeries: ISeriesApi<'Candlestick'> | null = null;
    let volumeSeries: ISeriesApi<'Histogram'> | null = null;
    let sma20Series: ISeriesApi<'Line'> | null = null;
    let sma50Series: ISeriesApi<'Line'> | null = null;
    let ema9Series: ISeriesApi<'Line'> | null = null;
    let rsiSeries: ISeriesApi<'Line'> | null = null;
    let macdSeries: ISeriesApi<'Line'> | null = null;
    let signalSeries: ISeriesApi<'Line'> | null = null;
    let atrSeries: ISeriesApi<'Line'> | null = null;
    let bbUpperSeries: ISeriesApi<'Line'> | null = null;
    let bbMiddleSeries: ISeriesApi<'Line'> | null = null;
    let bbLowerSeries: ISeriesApi<'Line'> | null = null;
    let stochasticKSeries: ISeriesApi<'Line'> | null = null;
    let stochasticDSeries: ISeriesApi<'Line'> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function mount() {
      const { CandlestickSeries, HistogramSeries, LineSeries, createChart } = await import(
        'lightweight-charts'
      );
      if (cancelled || !container) return;

      chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight || 480,
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

      // Main candlestick series
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

      // Volume series
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

      // Moving averages
      if (toggles.sma20 && technical) {
        sma20Series = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          title: 'SMA 20',
          priceFormat: { type: 'price', precision: pricePrecision },
        });
        sma20Series.setData(
          technical.indicators.sma_20
            .map((value: number | null, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
      }

      if (toggles.sma50 && technical) {
        sma50Series = chart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 1,
          title: 'SMA 50',
          priceFormat: { type: 'price', precision: pricePrecision },
        });
        sma50Series.setData(
          technical.indicators.sma_50
            .map((value: number | null, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
      }

      if (toggles.ema9 && technical) {
        ema9Series = chart.addSeries(LineSeries, {
          color: '#22c55e',
          lineWidth: 1,
          title: 'EMA 9',
          priceFormat: { type: 'price', precision: pricePrecision },
        });
        ema9Series.setData(
          technical.indicators.ema_9
            .map((value: any, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value?.value ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
      }

      // Bollinger Bands
      if (toggles.bbands && technical) {
        bbUpperSeries = chart.addSeries(LineSeries, {
          color: 'rgba(239, 68, 68, 0.5)',
          lineWidth: 1,
          priceFormat: { type: 'price', precision: pricePrecision },
        });
        bbMiddleSeries = chart.addSeries(LineSeries, {
          color: 'rgba(251, 191, 36, 0.5)',
          lineWidth: 1,
          priceFormat: { type: 'price', precision: pricePrecision },
        });
        bbLowerSeries = chart.addSeries(LineSeries, {
          color: 'rgba(34, 211, 153, 0.5)',
          lineWidth: 1,
          priceFormat: { type: 'price', precision: pricePrecision },
        });

        const bbData = technical.indicators.bbands_20_2;
        bbUpperSeries.setData(
          bbData
            .map((value: any, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value?.upper ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
        bbMiddleSeries.setData(
          bbData
            .map((value: any, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value?.middle ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
        bbLowerSeries.setData(
          bbData
            .map((value: any, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value?.lower ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
      }

      // RSI Subchart
      if (toggles.rsi && technical) {
        rsiSeries = chart.addSeries(LineSeries, {
          color: '#60a5fa',
          lineWidth: 1,
          priceScaleId: 'rsi',
          priceFormat: { type: 'price', precision: 1 },
        });
        chart.priceScale('rsi').applyOptions({
          scaleMargins: { top: 0.7, bottom: 0 },
        });
        rsiSeries.setData(
          technical.indicators.rsi_14
            .map((value: number | null, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
      }

      // MACD Subchart
      if (toggles.macd && technical) {
        macdSeries = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          priceScaleId: 'macd',
          priceFormat: { type: 'price', precision: 4 },
        });
        signalSeries = chart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 1,
          priceScaleId: 'macd',
          priceFormat: { type: 'price', precision: 4 },
        });
        chart.priceScale('macd').applyOptions({
          scaleMargins: { top: 0.15, bottom: 0.15 },
        });

        const macdData = technical.indicators.macd;
        macdSeries.setData(
          macdData
            .map((value: any, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value?.macd ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
        signalSeries.setData(
          macdData
            .map((value: any, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value?.signal ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
      }

      // ATR Subchart
      if (toggles.atr && technical) {
        atrSeries = chart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 1,
          priceScaleId: 'atr',
          priceFormat: { type: 'price', precision: 4 },
        });
        chart.priceScale('atr').applyOptions({
          scaleMargins: { top: 0.15, bottom: 0.15 },
        });
        atrSeries.setData(
          technical.indicators.atr_14
            .map((value: number | null, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
      }

      // Stochastic Subchart
      if (toggles.stochastic && technical) {
        stochasticKSeries = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          priceScaleId: 'stochastic',
          priceFormat: { type: 'price', precision: 1 },
        });
        stochasticDSeries = chart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 1,
          priceScaleId: 'stochastic',
          priceFormat: { type: 'price', precision: 1 },
        });
        chart.priceScale('stochastic').applyOptions({
          scaleMargins: { top: 0.15, bottom: 0.15 },
        });

        const stochData = technical.indicators.stochastic_14_3_3;
        stochasticKSeries.setData(
          stochData
            .map((value: any, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value?.k ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
        stochasticDSeries.setData(
          stochData
            .map((value: any, i: number): DataPoint => ({
              time: Math.floor(series.candles[i]!.time / 1000) as UTCTimestamp,
              value: value?.d ?? 0,
            }))
            .filter((d: DataPoint) => d.value !== 0),
        );
      }

      chart.timeScale().fitContent();

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chart) return;
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) {
          chart.applyOptions({ width, height: container.clientHeight || 480 });
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
      sma20Series = null;
      sma50Series = null;
      ema9Series = null;
      rsiSeries = null;
      macdSeries = null;
      signalSeries = null;
      atrSeries = null;
      bbUpperSeries = null;
      bbMiddleSeries = null;
      bbLowerSeries = null;
      stochasticKSeries = null;
      stochasticDSeries = null;
      chart?.remove();
      chart = null;
    };
  }, [series, technical, pricePrecision, tickSize, toggles]);

  if (series.candles.length === 0) {
    return (
      <div className="empty-state">
        <h3>No candles available</h3>
        <p>The provider returned an empty series. No synthetic candles were generated.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="indicator-toggles">
        {(Object.entries(toggles) as [keyof IndicatorToggles, boolean][]).map(([key, value]) => (
          <button
            key={key}
            type="button"
            className={`toggle-btn ${value ? 'active' : ''}`}
            onClick={() => setToggles((prev) => ({ ...prev, [key]: !prev[key] }))}
          >
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="price-chart"
        role="img"
        aria-label={`${series.instrument} ${series.timeframe} candlestick chart with technical indicators`}
      />
    </div>
  );
}
