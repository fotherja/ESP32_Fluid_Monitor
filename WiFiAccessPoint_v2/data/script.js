document.addEventListener('DOMContentLoaded', () => {
  // LED control
  document.getElementById('on').addEventListener('click', () => {
    fetch('/H').then(r => r.text()).then(console.log);
  });
  document.getElementById('off').addEventListener('click', () => {
    fetch('/L').then(r => r.text()).then(console.log);
  });

  // Resize the canvas element to 80% of viewport width and maintain a 1:0.5 aspect ratio
  const canvas = document.getElementById('myChart');
  const targetWidth = window.innerWidth * 0.8;
  canvas.width = targetWidth;
  canvas.height = targetWidth * 0.5; // height = 50% of width

  // Center the canvas horizontally
  canvas.style.display = 'block';
  canvas.style.margin = '20px auto';

  // Initialize Chart.js chart (static size)
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => i.toString()),
      datasets: [{
        label: 'Value',
        data: Array(24).fill(0),
        backgroundColor: 'rgba(0,123,255,0.5)',
        borderColor: 'rgba(0,123,255,1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { autoSkip: false } },
        y: { beginAtZero: true }
      }
    }
  });

  // Fetch new data and update the chart dataset
  function updateChart() {
    fetch('/data')
      .then(resp => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      })
      .then(data => {
        chart.data.datasets[0].data = data;
        chart.update();
        console.log('Chart updated:', data);
      })
      .catch(err => console.error('Error updating chart:', err));
  }

  // Initial draw and periodic refresh every 5 seconds
  updateChart();
  setInterval(updateChart, 5000);
});
