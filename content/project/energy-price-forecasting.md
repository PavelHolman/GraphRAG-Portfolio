---
title: Forecasting energy costs in day-ahead and intraday markets
summary: "Bachelor's thesis: AutoML pipeline forecasting electricity prices from market, weather and grid data."
start: 2024-09
end: 2025-06
url: https://dspace.cvut.cz/entities/publication/2fe340b7-601e-49d4-a5e4-06f07fbff4bb
uses:
  - { to: skill/python, note: 'pipeline in Python with pandas and AutoGluon' }
  - {
      to: skill/time-series-forecasting,
      note: 'seven-day hourly day-ahead and 15-minute intraday forecasts with chronological splits and multi-window evaluation',
    }
in-domain: [domain/energy-markets]
---

Bachelor's thesis at CTU FIT (2025), supervised in Prof. Zdeněk Hanzálek's group. Built an automated, modular electricity-price forecasting pipeline with AutoGluon and pandas, integrating OTE market data, Open-Meteo weather observations and forecasts, and ENTSO-E power-grid data, with cleaning, transformation and merging of multi-source time series. Forecasting tasks: seven-day hourly forecasts for the day-ahead market and one-day forecasts at 15-minute resolution for the intraday market. Compared statistical, machine-learning and deep-learning models against simple baselines using chronological splits and multi-window evaluation; traditional machine-learning models (gradient-boosted trees and random forests) beat the deep-learning models on this data, a result Pavel values for the simplicity and explainability of the winning models. Noted limitations: weather-forecast availability, a short historical window, and extreme price spikes.
