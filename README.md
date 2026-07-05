# Hollow Japan 日本空洞化

An interactive visualization of Japanese municipal population change from 1980 to 2050, with both a 2D Leaflet map and a 3D Three.js isometric map.

Data is available for every year (1-year intervals), with census years (1980–2020 every 5 years) and projected years (2025–2050 every 5 years) drawn from official sources, and intermediate years computed by linear interpolation.

Coded using Zed and Deepseek, total tokens expended around 100,000,000 (US$0.97).

## Features

- **Dual views**: 2D Leaflet map (`index.html`) and 3D Three.js isometric map (`3d.html`)
- **Year slider** with play/pause animation through all 71 years (1980–2050)
- **Two colour modes**:
  - **Last 5 years** — shows % change from the previous 5-year mark (scale: −10% to +10%)
  - **Since 1980** — shows cumulative % change since 1980 (scale: −90% to +90%, with deep red fading to black for extreme decline)
- **Language toggle**: switch between English and Japanese labels
- **Hover info**: click or hover any municipality to see population, 5-year change, and change since 1980
- **National population** displayed below the slider
- **Responsive design**: works on mobile with compact controls

## Installation

The code is pure Javascript and can be run locally with any HTTP server. GeoJSON shapes for municipalities are not included in this repository and must be sourced from [simplify-japan-geojson](https://github.com/ricewin/simplify-japan-geojson).

```bash
git clone https://github.com/jpatokal/hollow-japan.git
cd hollow-japan
git clone https://github.com/ricewin/simplify-japan-geojson.git
python3 -m http.server 8080
```

Then open:
- **2D map**: http://localhost:8080/
- **3D map**: http://localhost:8080/3d.html

## Data sources

Data is sourced from publicly available Japanese government statistics.

### Census data (1980–2020)

Per-municipality population data for census years 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020 from [e-Stat](https://www.e-stat.go.jp), search for 国勢調査 人口等基本集計 第1-1. At time of writing, results for the 2025 census have not yet been published.

Historical municipality boundaries change over time due to mergers and splits. 
[Keisuke Kondo's data and tooling](https://keisukekondokk.github.io/data/index.html#municipalcode) was used to reconcile boundaries from 1980 to 2020.

### Future projections (2025–2050)

Population projections for future years (2025–2050) are sourced from the [National Institute of Population and Social Security Research](https://www.ipss.go.jp), specifically Table 2 (都道府県・市区町村別の総人口) of the [2023 projection by region](https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/t-page.asp) (日本の地域別将来推計人口 令和５(2023)年推計).

### Interpolation

All non-census and non-projected years (1981–1984, 1986–1989, etc.) are computed by simple linear interpolation between the nearest available data points.

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).
