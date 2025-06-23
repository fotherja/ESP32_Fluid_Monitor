const DATA_POINT_INTERVAL_MINS = 15;
const MAX_DATA_POINTS = (7 * 24 * 60) / DATA_POINT_INTERVAL_MINS;
const BAR_COUNTS = {
    6: 24,
    24: 24,
    72: 72,
    168: 7
};
const THRESHOLDS = {
    GOOD: 0.5,
    ADEQUATE: 0.3
};

let currentRangeHours = 6;
let currentOffsetHours = 0;
let masterData = [];
let patientWeight = 70;

const chartView = document.getElementById('chart-view');
const disconnectedView = document.getElementById('disconnected-view');
const dateDisplay = document.getElementById('date-display');
const chartLoading = document.getElementById('chart-loading');
const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const patientWeightInput = document.getElementById('patient-weight');
const ctx = document.getElementById('fluidChart').getContext('2d');
let chart;

function getBarColor(volume, timeSpanHours, weight) {
    const ratePerHour = volume / (weight * timeSpanHours);
    if (ratePerHour >= THRESHOLDS.GOOD) {
        return 'rgba(46, 204, 113, 0.7)'; // Green
    } else if (ratePerHour >= THRESHOLDS.ADEQUATE) {
        return 'rgba(243, 156, 18, 0.7)'; // Amber
    } else {
        return 'rgba(231, 76, 60, 0.7)'; // Red
    }
}

function getBorderColor(volume, timeSpanHours, weight) {
    const ratePerHour = volume / (weight * timeSpanHours);
    if (ratePerHour >= THRESHOLDS.GOOD) {
        return 'rgba(46, 204, 113, 0.9)';
    } else if (ratePerHour >= THRESHOLDS.ADEQUATE) {
        return 'rgba(243, 156, 18, 0.9)';
    } else {
        return 'rgba(231, 76, 60, 0.9)';
    }
}

function initChart() {
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => {
                            const date = new Date(tooltipItems[0].raw.x);
                            return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                        },
                        label: (context) => {
                            const volume = context.parsed.y;
                            const timeSpanHours = getTimeSpanForCurrentRange();
                            const rate = volume / (patientWeight * timeSpanHours);
                            return [
                                `Total Volume: ${volume.toFixed(1)} ml`,
                                `Rate: ${rate.toFixed(2)} ml/kg/hour`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        tooltipFormat: 'MMM d, h:mm a',
                        displayFormats: { hour: 'h a', day: 'MMM d' }
                    },
                    grid: { display: false },
                    ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 20 }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Volume (ml)' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
}

function getTimeSpanForCurrentRange() {
    if (currentRangeHours === 6) return 0.25;
    if (currentRangeHours === 24) return 1;
    if (currentRangeHours === 72) return 1;
    if (currentRangeHours === 168) return 24;
    return 1;
}

async function fetchAndUpdateChart() {
    showLoading();
    try {
        const response = await fetch('/data');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        masterData = await response.json();
        
        while (masterData.length < MAX_DATA_POINTS) {
            masterData.unshift(0);
        }
        renderChartData();
    } catch (err) {
        console.error('Failed to fetch data:', err);
        masterData = Array(MAX_DATA_POINTS).fill(0); 
        renderChartData();
    } finally {
        hideLoading();
    }
}

function renderChartData() {
    const now = new Date();
    const totalPointsAvailable = masterData.length;
    const offsetPoints = (currentOffsetHours * 60) / DATA_POINT_INTERVAL_MINS;
    const rangePoints = (currentRangeHours * 60) / DATA_POINT_INTERVAL_MINS;
    const startIdx = Math.max(0, totalPointsAvailable - rangePoints - offsetPoints);
    const endIdx = totalPointsAvailable - offsetPoints;
    const dataSlice = masterData.slice(startIdx, endIdx);

    const chartData = [];
    const backgroundColors = [];
    const borderColors = [];
    
    let timeUnit = 'hour';
    const timeSpanHours = getTimeSpanForCurrentRange();
    
    // This function will process the raw values (or summed chunks)
    const processDataPoint = (value, time) => {
        chartData.push({ x: time.valueOf(), y: value });
        backgroundColors.push(getBarColor(value, timeSpanHours, patientWeight));
        borderColors.push(getBorderColor(value, timeSpanHours, patientWeight));
    };

    if (dataSlice.length > 0) {
        if (currentRangeHours === 6) {
            timeUnit = 'hour';
            dataSlice.forEach((value, index) => {
                const timeForPoint = new Date(now.getTime() - ((offsetPoints + (rangePoints - (index + 1))) * DATA_POINT_INTERVAL_MINS * 60 * 1000));
                processDataPoint(value, timeForPoint);
            });
        } else { // Logic for 24h, 72h, 168h aggregation
            let pointsPerBar = 4; // Default for 24h and 72h
            if (currentRangeHours === 168) {
                pointsPerBar = 96;
                timeUnit = 'day';
            } else {
                timeUnit = 'hour';
            }

            for (let i = 0; i < dataSlice.length; i += pointsPerBar) {
                const chunk = dataSlice.slice(i, i + pointsPerBar);
                const sum = chunk.reduce((acc, val) => acc + val, 0);
                const timeForChunk = new Date(now.getTime() - ((offsetPoints + (rangePoints - (i + 1))) * DATA_POINT_INTERVAL_MINS * 60 * 1000));
                processDataPoint(sum, timeForChunk);
            }
        }
    }
    
    const dataset = chart.data.datasets[0];
    dataset.data = chartData;
    dataset.backgroundColor = backgroundColors;
    dataset.borderColor = borderColors;
    dataset.borderWidth = 1;
    dataset.borderRadius = 4;
    dataset.barPercentage = 0.9;
    dataset.categoryPercentage = 0.9;
    
    chart.options.scales.x.time.unit = timeUnit;
    
    chart.update();
    updateDateDisplay();
    updateNavButtons();
}

function changeRange(hours) {
    currentRangeHours = hours;
    currentOffsetHours = 0; 
    document.querySelectorAll('.control-group .range-btn').forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.control-group .range-btn[data-range='${hours}']`);
    if (activeButton) activeButton.classList.add('active');
    renderChartData();
}

function scrollData(direction) {
    const proposedOffset = currentOffsetHours - (direction * currentRangeHours);
    const maxOffset = ((MAX_DATA_POINTS * DATA_POINT_INTERVAL_MINS) / 60) - currentRangeHours;
    currentOffsetHours = Math.max(0, Math.min(proposedOffset, maxOffset));
    renderChartData();
}

function updateNavButtons() {
    const maxOffset = ((masterData.length * DATA_POINT_INTERVAL_MINS) / 60) - currentRangeHours;
    nextBtn.disabled = currentOffsetHours <= 0;
    backBtn.disabled = currentOffsetHours >= maxOffset;
}

function updateDateDisplay() {
    const now = new Date();
    const endDate = new Date(now.getTime() - (currentOffsetHours * 3600 * 1000));
    const startDate = new Date(endDate.getTime() - (currentRangeHours * 3600 * 1000));
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    dateDisplay.textContent = `Showing: ${startDate.toLocaleString([], options)} to ${endDate.toLocaleString([], options)}`;
}

function showLoading() { chartLoading.style.display = 'flex'; }
function hideLoading() { chartLoading.style.display = 'none'; }

function showDisconnectModal() { document.getElementById('disconnect-modal').style.display = 'flex'; }
function hideDisconnectModal() { document.getElementById('disconnect-modal').style.display = 'none'; }

async function disconnect() {
    hideDisconnectModal();
    try {
        const response = await fetch('/L'); 
        if (!response.ok) throw new Error('Callback to /L failed');
        
        chartView.style.display = 'none';
        disconnectedView.style.display = 'flex';
        statusIndicator.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
    } catch(err) {
        console.error("Error during disconnect:", err);
    }
}

async function startApp() {
    const weightInput = patientWeightInput.value;
    if (weightInput && weightInput > 0) {
        patientWeight = parseFloat(weightInput);
    }

    try {
        const response = await fetch('/H'); 
        if (!response.ok) throw new Error('Callback to /H failed');

        disconnectedView.style.display = 'none';
        chartView.style.display = 'flex';
        statusIndicator.classList.remove('disconnected');
        statusText.textContent = `Weight: ${patientWeight} kg`;
        
        await fetchAndUpdateChart();
        // Set an interval to fetch new data periodically
        setInterval(fetchAndUpdateChart, 60000); 
    } catch(err) {
        console.error("Error during start:", err);
    }
}

window.onload = async () => {
    // Show the disconnected view by default
    chartView.style.display = 'none';
    disconnectedView.style.display = 'flex';
    initChart();
};