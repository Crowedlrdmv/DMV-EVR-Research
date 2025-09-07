import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: "hsl(214.3, 31.8%, 91.4%)",
      },
    },
    x: {
      grid: {
        color: "hsl(214.3, 31.8%, 91.4%)",
      },
    },
  },
};

export const colorPalette = {
  primary: "hsl(221.2, 83.2%, 53.3%)",
  primaryAlpha: "hsla(221.2, 83.2%, 53.3%, 0.1)",
  secondary: "hsl(173, 58%, 39%)",
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(43, 74%, 66%)",
  danger: "hsl(0, 84.2%, 60.2%)",
};
