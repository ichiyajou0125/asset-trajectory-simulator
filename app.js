let assets = [];
let events = []; // 途中からの積立額・ボーナス額変更ルール
let chart = null;

window.onload = function() {
  // 初期銘柄（ボーナスは0円スタート）
  assets.push({
    id: 1,
    name: 'S&P500',
    returnRate: 7.0,
    amount: 35000,
    bMonth1: 6,
    bMonth2: 12,
    bonusAmount: 0,
    bonusStartYear: 1
  });
  updateList();
  updateAssetSelect();
  renderChart();
  onSliderChange(0);
};

// タブ切り替え（ボタンで行き来）
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  if (tabId === 'tab-monthly') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
  }
  document.getElementById(tabId).classList.add('active');
}

function updateYears(val) {
  document.getElementById('yearsVal').innerText = val + ' 年';
  const timeSlider = document.getElementById('timeSlider');
  if (timeSlider) {
    timeSlider.max = parseInt(val) * 12;
  }
  renderChart();
  onSliderChange(timeSlider ? timeSlider.value : 0);
}

function addAsset() {
  const nameInput = document.getElementById('assetName');
  const returnInput = document.getElementById('assetReturn');
  const amountInput = document.getElementById('assetAmount');
  const bm1Input = document.getElementById('bonusMonth1');
  const bm2Input = document.getElementById('bonusMonth2');
  const bAmountInput = document.getElementById('bonusAmount');
  const bStartYearInput = document.getElementById('bonusStartYear');

  const name = nameInput.value.trim() || `銘柄 ${assets.length + 1}`;
  const returnRate = parseFloat(returnInput.value) || 0;
  const amount = parseFloat(amountInput.value) || 0;
  const bMonth1 = parseInt(bm1Input.value) || 0;
  const bMonth2 = parseInt(bm2Input.value) || 0;
  const bonusAmount = parseFloat(bAmountInput.value) || 0;
  const bonusStartYear = parseInt(bStartYearInput.value) || 1;

  assets.push({
    id: Date.now(),
    name,
    returnRate,
    amount,
    bMonth1,
    bMonth2,
    bonusAmount,
    bonusStartYear
  });

  nameInput.value = '';
  document.getElementById('bonusAmount').value = '0';
  updateList();
  updateAssetSelect();
  renderChart();
  onSliderChange(document.getElementById('timeSlider').value);
}

function removeAsset(id) {
  assets = assets.filter(a => a.id !== id);
  events = events.filter(e => e.assetId !== id);
  updateList();
  updateAssetSelect();
  renderChart();
  onSliderChange(document.getElementById('timeSlider').value);
}

function updateList() {
  const list = document.getElementById('assetList');
  if (!list) return;
  list.innerHTML = '';

  assets.forEach(a => {
    let bonusDesc = 'ボーナス設定なし';
    if (a.bonusAmount > 0 && (a.bMonth1 > 0 || a.bMonth2 > 0)) {
      const months = [a.bMonth1, a.bMonth2].filter(m => m > 0).join('月, ') + '月';
      bonusDesc = `ボーナス: ${months} 各${a.bonusAmount.toLocaleString()}円 (${a.bonusStartYear}年目〜)`;
    }

    list.innerHTML += `
      <div class="item-card">
        <div>
          <strong>${a.name}</strong><br>
          年利:${a.returnRate}% / 基本月額:${a.amount.toLocaleString()}円<br>
          <span style="color: var(--accent); font-size: 0.8rem;">📦 ${bonusDesc}</span>
        </div>
        <button class="btn-danger" onclick="removeAsset(${a.id})">削除</button>
      </div>
    `;
  });
}

function updateAssetSelect() {
  const select = document.getElementById('activeAssetSelect');
  if (!select) return;
  select.innerHTML = '';
  assets.forEach(a => {
    select.innerHTML += `<option value="${a.id}">${a.name}</option>`;
  });
}

function onSliderChange(totalMonths) {
  const months = parseInt(totalMonths) || 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  
  const timeLabel = document.getElementById('timeLabel');
  if (timeLabel) timeLabel.innerText = `${y}年 ${m}ヶ月目`;

  calculateAndDisplayAtMonth(months);
}

// 期間中の複利計算ロジック（月額・ボーナス変更イベントの両方を計算）
function calculateAndDisplayAtMonth(targetMonths) {
  let grandTotal = 0;
  let breakdownHtml = '';

  assets.forEach(asset => {
    let balance = 0;
    const monthlyRate = asset.returnRate / 100 / 12;

    for (let m = 1; m <= targetMonths; m++) {
      const currentYear = Math.floor((m - 1) / 12) + 1;
      const currentMonthInYear = ((m - 1) % 12) + 1;

      // 該当月以前の最新の変更イベントを取得
      let currentMonthly = asset.amount;
      let currentBonus = asset.bonusAmount;

      const activeEvents = events
        .filter(e => e.assetId === asset.id && e.month <= m)
        .sort((a, b) => b.month - a.month);

      if (activeEvents.length > 0) {
        if (activeEvents[0].newMonthly !== undefined) currentMonthly = activeEvents[0].newMonthly;
        if (activeEvents[0].newBonus !== undefined) currentBonus = activeEvents[0].newBonus;
      }

      let currentInvestment = currentMonthly;

      // ボーナス加算判定
      if (currentBonus > 0 && currentYear >= asset.bonusStartYear) {
        if (currentMonthInYear === asset.bMonth1 || currentMonthInYear === asset.bMonth2) {
          currentInvestment += currentBonus;
        }
      }

      balance += currentInvestment;
      balance *= (1 + monthlyRate);
    }

    const val = Math.round(balance);
    grandTotal += val;
    breakdownHtml += `<div>・ ${asset.name}: ${val.toLocaleString()} 円</div>`;
  });

  const totalEl = document.getElementById('totalAssetsAtTime');
  const breakdownEl = document.getElementById('breakdownAtTime');

  if (totalEl) totalEl.innerText = `${grandTotal.toLocaleString()} 円`;
  if (breakdownEl) breakdownEl.innerHTML = breakdownHtml || '銘柄がありません';
}

// 指定年月からの月額・ボーナス額の変更を登録・適用
function applyTimelineChanges() {
  const select = document.getElementById('activeAssetSelect');
  const slider = document.getElementById('timeSlider');
  const monthlyInput = document.getElementById('newMonthlyAmount');
  const bonusInput = document.getElementById('newBonusAmount');

  if (!select || !select.value) {
    alert('対象の銘柄を選択してください。');
    return;
  }

  const assetId = parseInt(select.value);
  const month = parseInt(slider.value) || 0;
  const newMonthly = parseFloat(monthlyInput.value) || 0;
  const newBonus = parseFloat(bonusInput.value) || 0;

  if (month === 0) {
    alert('0ヶ月目以外の年月を指定してください。');
    return;
  }

  events = events.filter(e => !(e.assetId === assetId && e.month === month));
  events.push({ id: Date.now(), assetId, month, newMonthly, newBonus });

  updateEventList();
  renderChart();
  onSliderChange(month);
}

function removeEvent(id) {
  events = events.filter(e => e.id !== id);
  updateEventList();
  renderChart();
  onSliderChange(document.getElementById('timeSlider').value);
}

function updateEventList() {
  const list = document.getElementById('eventList');
  if (!list) return;
  list.innerHTML = '';

  events.forEach(e => {
    const asset = assets.find(a => a.id === e.assetId);
    if (!asset) return;
    const y = Math.floor(e.month / 12);
    const m = e.month % 12;

    list.innerHTML += `
      <div class="item-card">
        <div>
          <strong>${asset.name}</strong><br>
          ${y}年${m}ヶ月目〜: 月額 ${e.newMonthly.toLocaleString()}円 / ボーナス ${e.newBonus.toLocaleString()}円
        </div>
        <button class="btn-danger" onclick="removeEvent(${e.id})">削除</button>
      </div>
    `;
  });

  if (events.length === 0) {
    list.innerHTML = '<div style="font-size:0.85rem; color:var(--text-sub);">変更ルールはありません。</div>';
  }
}

// グラフ描画
function renderChart() {
  const yearsEl = document.getElementById('years');
  const maxYears = yearsEl ? (parseInt(yearsEl.value) || 30) : 30;
  const labels = Array.from({ length: maxYears + 1 }, (_, i) => `${i}年目`);
  const colors = ['#38bdf8', '#4ade80', '#f43f5e', '#a855f7', '#fbbf24'];

  const datasets = assets.map((asset, index) => {
    const data = [];
    const monthlyRate = asset.returnRate / 100 / 12;
    let balance = 0;

    data.push(0);

    for (let y = 1; y <= maxYears; y++) {
      for (let m = 1; m <= 12; m++) {
        const totalMonths = (y - 1) * 12 + m;
        const currentMonthInYear = m;

        let currentMonthly = asset.amount;
        let currentBonus = asset.bonusAmount;

        const activeEvents = events
          .filter(e => e.assetId === asset.id && e.month <= totalMonths)
          .sort((a, b) => b.month - a.month);

        if (activeEvents.length > 0) {
          if (activeEvents[0].newMonthly !== undefined) currentMonthly = activeEvents[0].newMonthly;
          if (activeEvents[0].newBonus !== undefined) currentBonus = activeEvents[0].newBonus;
        }

        let currentInvestment = currentMonthly;
        if (currentBonus > 0 && y >= asset.bonusStartYear) {
          if (currentMonthInYear === asset.bMonth1 || currentMonthInYear === asset.bMonth2) {
            currentInvestment += currentBonus;
          }
        }

        balance += currentInvestment;
        balance *= (1 + monthlyRate);
      }
      data.push(Math.round(balance));
    }

    const color = colors[index % colors.length];
    return {
      label: asset.name,
      data: data,
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 2,
      fill: true,
      tension: 0.3
    };
  });

  const canvas = document.getElementById('simChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#f8fafc' } },
        tooltip: {
          callbacks: {
            label: context => `${context.dataset.label}: ${context.raw.toLocaleString()} 円`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: {
          ticks: {
            color: '#94a3b8',
            callback: value => (value / 10000).toLocaleString() + ' 万円'
          },
          grid: { color: '#334155' }
        }
      }
    }
  });
}

/* --- 画像(PNG)保存処理 --- */
function exportImage() {
  // アプリ全体（またはチャート部分）をそのまま画像化
  const targetElement = document.getElementById('appContainer');
  const printBtn = document.querySelector('.print-btn');

  // キャプチャ時だけボタンを隠す
  if (printBtn) printBtn.style.display = 'none';

  html2canvas(targetElement, {
    backgroundColor: '#0f172a', // ダーク背景色を維持
    scale: 2 // 高画質化 (Retina対応)
  }).then(canvas => {
    // 画像ダウンロード用のリンクを動的に生成
    const link = document.createElement('a');
    link.download = 'Financial_Simulation_Result.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    // ボタンの表示を復元
    if (printBtn) printBtn.style.display = '';
  });
}

/* =========================================================
   ダウンロード用ヘルパー関数
   ========================================================= */
function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   復元データを画面に適用する関数
   ========================================================= */
function applyRestoredState(state) {
  if (!state || !Array.isArray(state.assets)) {
    throw new Error('データ構造が破損しています');
  }

  // グローバル変数を上書き
  assets = state.assets;
  events = Array.isArray(state.events) ? state.events : [];

  // 運用年数スライダーと表示を更新
  const yearsEl = document.getElementById('years');
  const yearsVal = state.years || 30;
  if (yearsEl) {
    yearsEl.value = yearsVal;
    document.getElementById('yearsVal').innerText = yearsVal + ' 年';
  }

  // 時期指定スライダーの上限を合わせ、0に戻す
  const timeSlider = document.getElementById('timeSlider');
  if (timeSlider) {
    timeSlider.max = yearsVal * 12;
    timeSlider.value = 0;
  }

  // 画面の各リストとチャートを再描画
  updateList();
  updateEventList();
  updateAssetSelect();
  renderChart();
  onSliderChange(0);
}

/* =========================================================
   エクスポート：ZIP ＋ PNGパッケージ出力（エラー対策版）
   ========================================================= */
function exportWithData() {
  const format = document.getElementById('exportFormat').value; // 'json', 'csv', 'bin'
  const targetElement = document.getElementById('appContainer');
  const exportControls = document.querySelector('.export-controls');
  const ioCard = document.querySelector('.io-card');

  // 1. キャプチャ時だけボタン類を一時非表示にする
  if (exportControls) exportControls.style.display = 'none';
  if (ioCard) ioCard.style.display = 'none';

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const baseName = `Financial_Sim_${timestamp}`;

  // 2. 万が一エラーが起きても必ずボタンが復活するように try-finally で囲む
  html2canvas(targetElement, {
    backgroundColor: '#0f172a',
    scale: 2
  }).then(canvas => {
    canvas.toBlob(async pngBlob => {
      try {
        const zip = new JSZip();
        zip.file(`${baseName}.png`, pngBlob);

        const currentYears = parseInt(document.getElementById('years').value) || 30;
        const state = { version: 1, years: currentYears, assets, events };

        if (format === 'json') {
          const jsonStr = JSON.stringify(state, null, 2);
          zip.file(`${baseName}.json`, jsonStr);
        } else if (format === 'csv') {
          const csvStr = serializeToCSV(state);
          const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // BOM付き
          zip.file(`${baseName}.csv`, new Blob([bom, csvStr]));
        } else if (format === 'bin') {
          const binBuffer = serializeToBIN(state);
          zip.file(`${baseName}.bin`, binBuffer);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        triggerBlobDownload(content, `${baseName}_package.zip`);
      } catch (err) {
        console.error('ZIP生成・ダウンロード中にエラー:', err);
        alert('ファイルの保存処理でエラーが発生しました: ' + err.message);
      } finally {
        // 成功しようが失敗しようが、ここで確実にボタンを復活させる
        if (exportControls) exportControls.style.display = 'flex';
        if (ioCard) ioCard.style.display = 'block';
      }
    }, 'image/png');
  }).catch(err => {
    console.error('html2canvasエラー:', err);
    alert('画面の画像化に失敗しました: ' + err.message);
    // キャプチャ自体が失敗した場合もボタンを復元
    if (exportControls) exportControls.style.display = 'flex';
    if (ioCard) ioCard.style.display = 'block';
  });
}

/* =========================================================
   インポート：ZIP（または従来単体ファイル）の自動判別・復元
   ========================================================= */
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = async function(e) {
    try {
      let restoredState = null;
      const buffer = e.target.result;

      if (ext === 'zip') {
        // ZIPファイルを解析して中のデータファイルを探す
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        
        let dataFileKey = null;
        let targetExt = '';

        // 拡張子を見てJSON, CSV, BINのいずれかを探す
        for (let filename of Object.keys(zipContent.files)) {
          const lower = filename.toLowerCase();
          if (lower.endsWith('.json') || lower.endsWith('.csv') || lower.endsWith('.bin')) {
            dataFileKey = filename;
            targetExt = lower.split('.').pop();
            break;
          }
        }

        if (!dataFileKey) {
          throw new Error('ZIP内に有効なシミュレーションデータファイル（.json/.csv/.bin）が見つかりません');
        }

        // データファイルの中身を読み込む
        if (targetExt === 'bin') {
          const arrayBuf = await zipContent.files[dataFileKey].async('arraybuffer');
          restoredState = parseFromBIN(arrayBuf);
        } else {
          const text = await zipContent.files[dataFileKey].async('text');
          if (targetExt === 'json') {
            restoredState = JSON.parse(text);
          } else if (targetExt === 'csv') {
            restoredState = parseFromCSV(text);
          }
        }

      } else if (ext === 'json') {
        restoredState = JSON.parse(new TextDecoder().decode(buffer));
      } else if (ext === 'csv') {
        restoredState = parseFromCSV(new TextDecoder().decode(buffer));
      } else if (ext === 'bin') {
        restoredState = parseFromBIN(buffer);
      } else {
        throw new Error('未対応のファイル形式です (.zip / .json / .csv / .bin)');
      }

      applyRestoredState(restoredState);
      alert(`「${file.name}」からデータを正常に復元しました！`);
    } catch (err) {
      console.error(err);
      alert('ファイルの読み込みに失敗しました: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsArrayBuffer(file);
}