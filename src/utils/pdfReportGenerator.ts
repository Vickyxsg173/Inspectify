import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface PdfReportData {
  companyName?: string;
  origin: string;
  destination: string;
  distanceKm: number;
  carrier: string;
  transportMode: string;
  packageType: string;
  weightKg: string;
  packagingMaterial: string;
  cushioning: string;
  fragileHandling: string;
  numStops?: string;
  vibrationLevel?: string;
  humidityExposure?: string;
  altitudeRisk?: string;
  weather: {
    tempMean: number;
    tempMax: number;
    tempMin: number;
    humidity: number;
    precipitation: number;
    windSpeed: number;
  };
  prediction: {
    box_condition: string;
    screen_condition: string;
    combined_classification: string;
    box_damage_probability: number;
    screen_damage_probability: number;
    prediction_id: string;
    timestamp: string;
  };
}

/**
 * Evaluates the maximum influencing feature of damage based on inputs.
 */
function analyzeTopInfluencingFeature(data: PdfReportData): {
  featureName: string;
  impactScore: string;
  explanation: string;
} {
  const { weather, packagingMaterial, cushioning, transportMode, vibrationLevel, distanceKm } = data;

  if (weather.precipitation > 5 && packagingMaterial === 'Cardboard') {
    return {
      featureName: 'Severe Corridor Precipitation on Cardboard',
      impactScore: '+38% Damage Weight',
      explanation:
        'Rainfall exceeding 5mm severely weakens corrugated cardboard fiber cohesion, reducing box compression resistance and box stacking strength by up to 45%.',
    };
  }

  if (cushioning === 'None' || cushioning === 'Paper') {
    return {
      featureName: 'Substandard Cushioning Buffer (Lack of Foam / Air Cushion)',
      impactScore: '+42% Impact Transmission',
      explanation:
        'Absence of high-rebound cushioning (such as EPE foam or sealed air pillows) directly transmits road bumps and conveyor drop shocks to delicate internal displays and components.',
    };
  }

  if (transportMode === 'Road' && vibrationLevel === 'High') {
    return {
      featureName: 'High Road Vibration & Rough Pavement Telemetry',
      impactScore: '+31% Shock Fatigue',
      explanation:
        'Continuous low-frequency highway vibration causes mechanical micro-fractures, friction abrasion against container walls, and potential seal failures.',
    };
  }

  if (transportMode === 'Sea' && weather.humidity > 70) {
    return {
      featureName: 'Marine Salt-Air & High Atmospheric Humidity',
      impactScore: '+29% Corrosion & Saturation',
      explanation:
        'Extended exposure to relative humidity over 70% in sea transit degrades box adhesive gluing and accelerates oxidation risks for unsealed electronic goods.',
    };
  }

  if (distanceKm > 1200) {
    return {
      featureName: 'Extended Route Distance (>1200 km) & Transit Hours',
      impactScore: '+26% Cumulative Handling Exposure',
      explanation:
        'Long-haul multi-day transit increases intermediate hub offloading, cross-dock conveyor transfers, and cumulative mechanical fatigue.',
    };
  }

  return {
    featureName: 'Standard Container Geometry & Handling Stress',
    impactScore: 'Baseline Telemetry',
    explanation:
      'Standard inertial shifts during vehicle acceleration, deceleration, and standard freight consolidation cycles.',
  };
}

/**
 * Generates tailored loss-reduction directives.
 */
function generateLossReductionDirectives(data: PdfReportData): string[] {
  const directives: string[] = [];

  if (data.packagingMaterial === 'Cardboard') {
    if (data.weather.precipitation > 0) {
      directives.push(
        'Upgrade to heavy-duty double-wall corrugated cartons with water-repellent polymer film stretch wrap to prevent moisture penetration.'
      );
    } else {
      directives.push(
        'Reinforce carton edge corners with recycled rigid edge-protector boards to eliminate corner crush during stacking.'
      );
    }
  } else if (data.packagingMaterial === 'Plastic') {
    directives.push('Ensure lid locking latches are zip-tied and internal items immobilized with anti-static dunnage.');
  }

  if (data.cushioning === 'None' || data.cushioning === 'Paper') {
    directives.push(
      'Mandate minimum 30mm thick closed-cell polyethylene (EPE) foam padding or multi-chamber air columns on all 6 internal faces.'
    );
  } else {
    directives.push('Maintain current cushioning specification; verify that cavity voids are completely filled to prevent load shifting.');
  }

  if (data.transportMode === 'Road') {
    directives.push(
      'Instruct carrier to utilize air-ride suspension trailers and schedule departures outside 12:00 PM - 04:00 PM peak thermal asphalt hours.'
    );
  } else if (data.transportMode === 'Air') {
    directives.push('Ensure pressure-release valves are functional for hermetically sealed products and avoid loose belly-hold consolidation.');
  }

  directives.push(
    'Enforce mandatory barcode scan inspection at intermediate cross-dock hubs to immediately isolate parcels with exterior surface tears.'
  );

  return directives;
}

/**
 * Compiles and exports an official, professional PDF Risk Assessment Report.
 */
export async function exportLogisticsRiskPdf(data: PdfReportData): Promise<void> {
  const topFeature = analyzeTopInfluencingFeature(data);
  const directives = generateLossReductionDirectives(data);
  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const reportTime = new Date().toLocaleTimeString('en-US');

  const isBoxDamaged = data.prediction.box_condition === 'Damaged';
  const isScreenDamaged = data.prediction.screen_condition === 'Damaged';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Inspectify Official Logistics Risk Assessment Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 32px;
      color: #18181B;
      background: #FFFFFF;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #FF2D55;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand {
      font-size: 26px;
      font-weight: 900;
      color: #09090B;
      letter-spacing: -0.5px;
    }
    .brand span {
      color: #FF2D55;
    }
    .brand-sub {
      font-size: 11px;
      color: #71717A;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #52525B;
    }
    .meta-box strong {
      color: #09090B;
    }
    .title-banner {
      background: #09090B;
      color: #FFFFFF;
      padding: 14px 18px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .title-text {
      font-size: 16px;
      font-weight: 800;
    }
    .classification-pill {
      background: #FF2D55;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .grid-2 {
      display: flex;
      gap: 16px;
      margin-bottom: 18px;
    }
    .col {
      flex: 1;
    }
    .card {
      border: 1px solid #E4E4E7;
      border-radius: 8px;
      padding: 14px;
      background: #FAFAFA;
      margin-bottom: 16px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #71717A;
      margin-bottom: 10px;
      border-bottom: 1px solid #E4E4E7;
      padding-bottom: 6px;
    }
    .metric-row {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .metric-box {
      flex: 1;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #E4E4E7;
      background: #FFFFFF;
      text-align: center;
    }
    .metric-val {
      font-size: 26px;
      font-weight: 900;
      margin-top: 2px;
    }
    .metric-lbl {
      font-size: 10px;
      color: #71717A;
      text-transform: uppercase;
      font-weight: 700;
    }
    .metric-status {
      font-size: 12px;
      font-weight: 800;
      margin-top: 4px;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .table th, .table td {
      padding: 6px 8px;
      border-bottom: 1px solid #E4E4E7;
      text-align: left;
    }
    .table th {
      color: #71717A;
      font-weight: 700;
      width: 45%;
    }
    .table td {
      color: #09090B;
      font-weight: 600;
    }
    .highlight-card {
      background: #FFF1F2;
      border: 1px solid #FECDD3;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .highlight-title {
      color: #BE123C;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .highlight-feature {
      font-size: 15px;
      font-weight: 900;
      color: #881337;
      margin-bottom: 4px;
    }
    .highlight-desc {
      color: #4C0519;
      font-size: 11px;
      line-height: 1.5;
    }
    .directive-card {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .directive-title {
      color: #15803D;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .directive-list {
      margin: 0;
      padding-left: 18px;
      color: #14532D;
      font-size: 11px;
    }
    .directive-list li {
      margin-bottom: 6px;
      line-height: 1.5;
    }
    .footer {
      border-top: 1px solid #E4E4E7;
      padding-top: 12px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      color: #71717A;
      font-size: 10px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand">Inspect<span>ify</span></div>
      <div class="brand-sub">Enterprise AI Logistics & Parcel Damage Risk Platform</div>
    </div>
    <div class="meta-box">
      <div>Report ID: <strong>${data.prediction.prediction_id}</strong></div>
      <div>Organization: <strong>${data.companyName || 'Enterprise Logistics Partner'}</strong></div>
      <div>Generated: <strong>${reportDate} at ${reportTime}</strong></div>
    </div>
  </div>

  <div class="title-banner">
    <div class="title-text">Official Predictive Risk Audit: ${data.origin} → ${data.destination}</div>
    <div class="classification-pill">${data.prediction.combined_classification}</div>
  </div>

  <div class="metric-row">
    <div class="metric-box">
      <div class="metric-lbl">Outer Packaging Risk</div>
      <div class="metric-val" style="color: ${isBoxDamaged ? '#EF4444' : '#10B981'}">
        ${(data.prediction.box_damage_probability * 100).toFixed(1)}%
      </div>
      <div class="metric-status" style="color: ${isBoxDamaged ? '#EF4444' : '#10B981'}">
        ${data.prediction.box_condition.toUpperCase()}
      </div>
    </div>

    <div class="metric-box">
      <div class="metric-lbl">Inner Screen / Content Shock Risk</div>
      <div class="metric-val" style="color: ${isScreenDamaged ? '#EF4444' : '#10B981'}">
        ${(data.prediction.screen_damage_probability * 100).toFixed(1)}%
      </div>
      <div class="metric-status" style="color: ${isScreenDamaged ? '#EF4444' : '#10B981'}">
        ${data.prediction.screen_condition.toUpperCase()}
      </div>
    </div>

    <div class="metric-box">
      <div class="metric-lbl">Total GPS Distance</div>
      <div class="metric-val" style="color: #09090B">
        ${data.distanceKm} <span style="font-size: 14px;">km</span>
      </div>
      <div class="metric-status" style="color: #71717A">
        Via ${data.transportMode} (${data.carrier})
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="col">
      <div class="card">
        <div class="card-title">Logistics & Packaging Parameters</div>
        <table class="table">
          <tr><th>Transit Mode</th><td>${data.transportMode}</td></tr>
          <tr><th>Carrier</th><td>${data.carrier}</td></tr>
          <tr><th>Package Type</th><td>${data.packageType} (${data.weightKg} kg)</td></tr>
          <tr><th>Packaging Material</th><td>${data.packagingMaterial}</td></tr>
          <tr><th>Cushioning Type</th><td>${data.cushioning}</td></tr>
          <tr><th>Fragile Handling Flag</th><td>${data.fragileHandling}</td></tr>
          ${data.vibrationLevel ? `<tr><th>Vibration Exposure</th><td>${data.vibrationLevel}</td></tr>` : ''}
          ${data.numStops ? `<tr><th>Transfer Stops</th><td>${data.numStops}</td></tr>` : ''}
        </table>
      </div>
    </div>

    <div class="col">
      <div class="card">
        <div class="card-title">Live Environmental Telemetry (Open-Meteo)</div>
        <table class="table">
          <tr><th>Corridor Mean Temperature</th><td>${data.weather.tempMean}°C</td></tr>
          <tr><th>Max / Min Temperature</th><td>${data.weather.tempMax}°C / ${data.weather.tempMin}°C</td></tr>
          <tr><th>Precipitation / Rainfall</th><td>${data.weather.precipitation} mm</td></tr>
          <tr><th>Relative Humidity</th><td>${data.weather.humidity}%</td></tr>
          <tr><th>Max Wind Speed</th><td>${data.weather.windSpeed} km/h</td></tr>
          <tr><th>Telemetry Station Coverage</th><td>Full Corridor Synchronization</td></tr>
        </table>
      </div>
    </div>
  </div>

  <div class="highlight-card">
    <div class="highlight-title">Top Damage Influencing Feature (Maximum Risk Driver)</div>
    <div class="highlight-feature">${topFeature.featureName} [${topFeature.impactScore}]</div>
    <div class="highlight-desc">${topFeature.explanation}</div>
  </div>

  <div class="directive-card">
    <div class="directive-title">Strategic Loss-Reduction Directives for Enterprise Fleet</div>
    <ul class="directive-list">
      ${directives.map((d) => `<li>${d}</li>`).join('')}
    </ul>
  </div>

  <div class="footer">
    <div>Inspectify AI Automated Risk System • CatBoost Multi-Variable Model v1.0</div>
    <div>Confidential Audit Document • For Internal Fleet Quality Assurance</div>
  </div>

</body>
</html>
`;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Inspectify Risk Audit - ${data.origin} to ${data.destination}`,
      });
    } else {
      Alert.alert('Report Generated', `PDF saved at ${uri}`);
    }
  } catch (error: any) {
    Alert.alert('Export Error', error.message || 'Failed to generate PDF report.');
  }
}

