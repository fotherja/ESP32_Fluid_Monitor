        // --- CONFIGURATION ---
        const DATA_POINT_INTERVAL_MINS = 15; // Changed from 5 to 15 minutes
        const MAX_DATA_POINTS = (7 * 24 * 60) / DATA_POINT_INTERVAL_MINS; // 7 days of data
        
        // Specific bar counts for different views
        const BAR_COUNTS = {
            6: 24,   // 6 hours: 24 bars (15 min each)
            24: 24,  // 24 hours: 24 bars (1 hour each) 
            72: 72,  // 3 days: 72 bars (1 hour each)
            168: 7   // 7 days: 7 bars (1 day each)
        };

        // --- STATE MANAGEMENT ---
        let currentRangeHours = 6; // Default view is now 6 hours
        let currentOffsetHours = 0; // Offset from the most recent data
        let masterData = []; // Store the full dataset from the device

        // --- DOM ELEMENT REFERENCES ---
        const chartView = document.getElementById('chart-view');
        const disconnectedView = document.getElementById('disconnected-view');
        const dateDisplay = document.getElementById('date-display');
        const chartLoading = document.getElementById('chart-loading');
        const backBtn = document.getElementById('back-btn');
        const nextBtn = document.getElementById('next-btn');
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        const ctx = document.getElementById('fluidChart').getContext('2d');
        let chart;

        // --- CHART INITIALIZATION ---
        function initChart() {
            chart = new Chart(ctx, {
                type: 'bar',
                data: { labels: [], datasets: [{ data: [] }] },
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
                                label: (context) => `Total Volume: ${context.parsed.y.toFixed(1)}`
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
                            title: { display: true, text: 'Volume' },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        }
                    },
                    datasets: {
                        bar: {
                            backgroundColor: 'rgba(0, 123, 255, 0.7)',
                            borderColor: 'rgba(0, 123, 255, 0.9)',
                            borderWidth: 1,
                            borderRadius: 4,
                            barPercentage: 0.9,
                            categoryPercentage: 0.9
                        }
                    }
                }
            });
        }
        
        // --- DATA FETCHING & CHART UPDATING ---
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

            let chartData = [];
            let timeUnit = 'hour';
            const targetBars = BAR_COUNTS[currentRangeHours];

            if (dataSlice.length > 0) {
                if (currentRangeHours === 6) {
                    // 6 hours: Each bar is 15 minutes (24 bars total)
                    chartData = dataSlice.map((value, index) => {
                        const timeForPoint = new Date(now.getTime() - ((offsetPoints + (rangePoints - (index + 1))) * DATA_POINT_INTERVAL_MINS * 60 * 1000));
                        return { x: timeForPoint.valueOf(), y: value };
                    });
                    timeUnit = 'hour';
                } else if (currentRangeHours === 24) {
                    // 24 hours: Each bar is 1 hour (24 bars total)
                    const pointsPerBar = 4; // 4 points of 15 min each = 1 hour
                    
                    for (let i = 0; i < dataSlice.length; i += pointsPerBar) {
                        const chunk = dataSlice.slice(i, i + pointsPerBar);
                        const sum = chunk.reduce((acc, val) => acc + val, 0);

                        const timeForChunk = new Date(now.getTime() - ((offsetPoints + (rangePoints - (i + 1))) * DATA_POINT_INTERVAL_MINS * 60 * 1000));
                        chartData.push({ x: timeForChunk.valueOf(), y: sum });
                    }
                    timeUnit = 'hour';
                } else if (currentRangeHours === 72) {
                    // 3 days: Each bar is 1 hour (72 bars total)
                    const pointsPerBar = 4; // 4 points of 15 min each = 1 hour
                    
                    for (let i = 0; i < dataSlice.length; i += pointsPerBar) {
                        const chunk = dataSlice.slice(i, i + pointsPerBar);
                        const sum = chunk.reduce((acc, val) => acc + val, 0);

                        const timeForChunk = new Date(now.getTime() - ((offsetPoints + (rangePoints - (i + 1))) * DATA_POINT_INTERVAL_MINS * 60 * 1000));
                        chartData.push({ x: timeForChunk.valueOf(), y: sum });
                    }
                    timeUnit = 'hour';
                } else if (currentRangeHours === 168) {
                    // 7 days: Each bar is 1 day (7 bars total)
                    const pointsPerBar = 96; // 96 points of 15 min each = 1 day
                    
                    for (let i = 0; i < dataSlice.length; i += pointsPerBar) {
                        const chunk = dataSlice.slice(i, i + pointsPerBar);
                        const sum = chunk.reduce((acc, val) => acc + val, 0);

                        const timeForChunk = new Date(now.getTime() - ((offsetPoints + (rangePoints - (i + 1))) * DATA_POINT_INTERVAL_MINS * 60 * 1000));
                        chartData.push({ x: timeForChunk.valueOf(), y: sum });
                    }
                    timeUnit = 'day';
                }
            }
            
            chart.data.datasets[0].data = chartData;
            chart.options.scales.x.time.unit = timeUnit;
            
            chart.update();
            updateDateDisplay();
            updateNavButtons();
        }

        // --- UI CONTROL FUNCTIONS ---

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
        
        // --- DISCONNECT / START FLOW ---
        
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
            try {
                const response = await fetch('/H'); 
                if (!response.ok) throw new Error('Callback to /H failed');

                disconnectedView.style.display = 'none';
                chartView.style.display = 'flex';
                statusIndicator.classList.remove('disconnected');
                statusText.textContent = 'Connected';
                
                await fetchAndUpdateChart(); 
            } catch(err) {
                console.error("Error during start:", err);
            }
        }
        
        // --- INITIALIZATION ON PAGE LOAD ---
        window.onload = async () => {
            initChart();
            await fetchAndUpdateChart();
            setInterval(fetchAndUpdateChart, 60000); 
        };