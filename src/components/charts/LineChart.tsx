interface DataPoint {
  x: number
  y: number
}

interface LineChartProps {
  data: DataPoint[]
  width?: number
  height?: number
  color?: string
  yLabel?: string
  xLabel?: string
  yMin?: number
  yMax?: number
  showPoints?: boolean
}

export function LineChart({
  data,
  width = 600,
  height = 200,
  color = '#3b82f6',
  yLabel,
  xLabel,
  yMin,
  yMax,
  showPoints = true,
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-slate-900 rounded-lg" style={{ width, height }}>
        <p className="text-slate-500">No data to display</p>
      </div>
    )
  }

  const leftPadding = 60 // Space for y-axis label and tick values
  const rightPadding = 80 // Space on right edge
  const topPadding = 20
  const bottomPadding = 40 // Space for x-axis label
  const chartWidth = width - leftPadding - rightPadding
  const chartHeight = height - topPadding - bottomPadding

  // Find data bounds
  const xValues = data.map(d => d.x)
  const yValues = data.map(d => d.y)
  const xMinData = Math.min(...xValues)
  const xMaxData = Math.max(...xValues)
  const yMinData = yMin !== undefined ? yMin : Math.min(...yValues)
  const yMaxData = yMax !== undefined ? yMax : Math.max(...yValues)

  // Add some padding to y-axis
  const yRange = yMaxData - yMinData
  const yPadding = yRange * 0.1
  const yMinPlot = yMinData - yPadding
  const yMaxPlot = yMaxData + yPadding

  // Scale functions
  const scaleX = (x: number) => {
    const range = xMaxData - xMinData || 1
    return leftPadding + ((x - xMinData) / range) * chartWidth
  }

  const scaleY = (y: number) => {
    const range = yMaxPlot - yMinPlot || 1
    return height - bottomPadding - ((y - yMinPlot) / range) * chartHeight
  }

  // Generate path
  const pathData = data
    .map((point, i) => {
      const x = scaleX(point.x)
      const y = scaleY(point.y)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Generate grid lines (5 horizontal lines)
  const gridLines = []
  for (let i = 0; i <= 4; i++) {
    const y = yMinPlot + (yMaxPlot - yMinPlot) * (i / 4)
    const yPos = scaleY(y)
    gridLines.push(
      <line
        key={i}
        x1={leftPadding}
        y1={yPos}
        x2={width - rightPadding}
        y2={yPos}
        stroke="#334155"
        strokeWidth="1"
        strokeDasharray="2,2"
      />
    )
  }

  // Y-axis labels
  const yAxisLabels = []
  for (let i = 0; i <= 4; i++) {
    const y = yMinPlot + (yMaxPlot - yMinPlot) * (i / 4)
    const yPos = scaleY(y)
    yAxisLabels.push(
      <text
        key={i}
        x={leftPadding - 8}
        y={yPos + 4}
        textAnchor="end"
        fontSize="10"
        fill="#94a3b8"
      >
        {y.toFixed(2)}
      </text>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <svg width={width} height={height}>
        {/* Grid lines */}
        {gridLines}

        {/* Axes */}
        <line
          x1={leftPadding}
          y1={height - bottomPadding}
          x2={width - rightPadding}
          y2={height - bottomPadding}
          stroke="#475569"
          strokeWidth="2"
        />
        <line
          x1={leftPadding}
          y1={topPadding}
          x2={leftPadding}
          y2={height - bottomPadding}
          stroke="#475569"
          strokeWidth="2"
        />

        {/* Y-axis labels */}
        {yAxisLabels}

        {/* Y-axis title */}
        {yLabel && (
          <text
            x={16}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill="#94a3b8"
            transform={`rotate(-90 16 ${height / 2})`}
          >
            {yLabel}
          </text>
        )}

        {/* X-axis title */}
        {xLabel && (
          <text
            x={leftPadding + chartWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize="12"
            fill="#94a3b8"
          >
            {xLabel}
          </text>
        )}

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {showPoints &&
          data.map((point, i) => (
            <circle
              key={i}
              cx={scaleX(point.x)}
              cy={scaleY(point.y)}
              r="3"
              fill={color}
              stroke="#1e293b"
              strokeWidth="2"
            />
          ))}
      </svg>
    </div>
  )
}
