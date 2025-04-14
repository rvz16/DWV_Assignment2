const socket = io()
const map = L.map("map").setView([20, 0], 2)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map)

const markers = []
const locationCounts = {}
const timeBuckets = {}

// Track the start and end times for our time window
let startTimestamp = null
let endTimestamp = null
const TIME_WINDOW_MINUTES = 60 // Show 60 minutes of data by default
const BUCKET_SIZE_SECONDS = 60 // Group data in 1-minute buckets

// Chart.js setup
const ctx = document.getElementById("activityChart").getContext("2d")
const chart = new Chart(ctx, {
  type: "bar",
  data: {
    labels: [], // Will be populated dynamically
    datasets: [
      {
        label: "Packages per Minute",
        data: [],
        backgroundColor: "rgba(54, 162, 235, 0.6)",
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Packages",
        },
      },
      x: {
        title: {
          display: true,
          text: "Time (HH:MM:SS)",
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (tooltipItems) => tooltipItems[0].label,
          label: (context) => `Packages: ${context.raw}`,
        },
      },
    },
  },
})

// Initialize the chart with the first packet
function initializeTimeChart(firstTimestamp) {
  // Use the first packet's timestamp to initialize the window
  startTimestamp = firstTimestamp
  endTimestamp = startTimestamp + TIME_WINDOW_MINUTES * 60

  // Create empty buckets for the time window
  const bucketCount = TIME_WINDOW_MINUTES
  chart.data.labels = []
  chart.data.datasets[0].data = []

  for (let i = 0; i < bucketCount; i++) {
    const bucketTime = startTimestamp + i * BUCKET_SIZE_SECONDS
    const date = new Date(bucketTime * 1000)
    const timeLabel = date.toTimeString().substring(0, 8) // HH:MM:SS

    chart.data.labels.push(timeLabel)
    chart.data.datasets[0].data.push(0)
    timeBuckets[bucketTime] = 0
  }

  chart.update()
}

// Handle incoming packages
socket.on("new_package", (data) => {
  const timestamp = data.timestamp

  // Initialize chart if this is the first package
  if (startTimestamp === null) {
    initializeTimeChart(timestamp)
  }

  // Check if we need to expand the time window
  if (timestamp < startTimestamp || timestamp > endTimestamp) {
    expandTimeWindow(timestamp)
  }

  // Update the map
  const marker = L.circleMarker([data.latitude, data.longitude], {
    radius: 6,
    color: data.suspicious ? "red" : "green",
    fillOpacity: 0.8,
  }).addTo(map)
  marker.bindPopup(`IP: ${data.ip_address}<br>${data.human_readable_time}`)
  markers.push(marker)

  setTimeout(() => map.removeLayer(marker), 10000)

  // Update location statistics
  const locKey = `${data.latitude.toFixed(2)},${data.longitude.toFixed(2)}`
  locationCounts[locKey] = (locationCounts[locKey] || 0) + 1
  updateLocationList()

  // Update time chart
  updateTimeChart(timestamp)
})

// Expand the time window if needed
function expandTimeWindow(timestamp) {
  // If timestamp is before our current window
  if (timestamp < startTimestamp) {
    const timeShift = Math.ceil((startTimestamp - timestamp) / BUCKET_SIZE_SECONDS)
    startTimestamp -= timeShift * BUCKET_SIZE_SECONDS

    // Add new buckets at the beginning
    const newLabels = []
    const newData = []

    for (let i = 0; i < timeShift; i++) {
      const newBucketTime = startTimestamp + i * BUCKET_SIZE_SECONDS
      const date = new Date(newBucketTime * 1000)
      const timeLabel = date.toTimeString().substring(0, 8) // HH:MM:SS

      newLabels.push(timeLabel)
      newData.push(0)
      timeBuckets[newBucketTime] = 0
    }

    chart.data.labels = [...newLabels, ...chart.data.labels]
    chart.data.datasets[0].data = [...newData, ...chart.data.datasets[0].data]
  }

  // If timestamp is after our current window
  if (timestamp > endTimestamp) {
    const timeShift = Math.ceil((timestamp - endTimestamp) / BUCKET_SIZE_SECONDS)
    endTimestamp += timeShift * BUCKET_SIZE_SECONDS

    // Add new buckets at the end
    for (let i = 0; i < timeShift; i++) {
      const newBucketTime = endTimestamp - (timeShift - i - 1) * BUCKET_SIZE_SECONDS
      const date = new Date(newBucketTime * 1000)
      const timeLabel = date.toTimeString().substring(0, 8) // HH:MM:SS

      chart.data.labels.push(timeLabel)
      chart.data.datasets[0].data.push(0)
      timeBuckets[newBucketTime] = 0
    }
  }
}

function updateTimeChart(timestamp) {
  // Find the appropriate bucket for this timestamp
  const bucketIndex = Math.floor((timestamp - startTimestamp) / BUCKET_SIZE_SECONDS)

  // Only update if the timestamp falls within our current window
  if (bucketIndex >= 0 && bucketIndex < chart.data.datasets[0].data.length) {
    chart.data.datasets[0].data[bucketIndex]++
    chart.update()
  }
}

function updateLocationList() {
  const list = document.getElementById("location-list")
  const sorted = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])
  list.innerHTML = ""
  sorted.slice(0, 5).forEach(([loc, count]) => {
    const li = document.createElement("li")
    li.textContent = `${loc} — ${count}`
    list.appendChild(li)
  })
}

// No need to initialize the chart on page load - we'll wait for the first packet
