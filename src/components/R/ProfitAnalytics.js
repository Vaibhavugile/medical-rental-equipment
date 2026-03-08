import React from "react";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from "recharts";

import "./profitAnalytics.css";

const formatCurrency = v =>
    Number(v || 0).toLocaleString("en-IN");

export default function ProfitAnalytics({ data = {} }) {

    const revenue = Number(data.revenue || 0);
    const salary = Number(data.salaryTotal || 0);
    const profit = Number(data.profit || 0);

    const margin =
        revenue
            ? ((profit / revenue) * 100).toFixed(1)
            : 0;

    /* chart data */

    const chartData = [

        {
            name: "Revenue",
            value: revenue
        },

        {
            name: "Salary Cost",
            value: salary
        },

        {
            name: "Profit",
            value: profit
        }

    ];

    return (

        <div className="nor-block">

            <h2 className="nor-section-title">
                Profit Analytics
            </h2>

            <div className="nor-profit-layout">

                {/* LEFT SUMMARY */}

                <div className="nor-profit-summary">

                    <Metric
                        label="Invoice Total"
                        value={`₹ ${formatCurrency(data.invoiceTotal)}`}
                    />

                    <Metric
                        label="Revenue Collected"
                        value={`₹ ${formatCurrency(revenue)}`}
                    />

                    <Metric
                        label="Salary Cost"
                        value={`₹ ${formatCurrency(salary)}`}
                    />

                    <Metric
                        label="Profit"
                        value={`₹ ${formatCurrency(profit)}`}
                        highlight
                    />

                    <div className="nor-profit-margin">

                        <div className="nor-margin-label">
                            Profit Margin
                        </div>

                        <div className={`nor-margin-value ${profit >= 0
                                ? "nor-profit-positive"
                                : "nor-profit-negative"
                            }`}>

                            {margin} %

                        </div>

                    </div>

                </div>

                {/* RIGHT CHART */}

                <div className="nor-profit-chart">

                    <ResponsiveContainer
                        width="100%"
                        height={260}
                    >

                        <BarChart data={chartData}>

                            <CartesianGrid strokeDasharray="3 3" />

                            <XAxis dataKey="name" />

                            <YAxis />

                            <Tooltip
                                formatter={(v) =>
                                    `₹ ${formatCurrency(v)}`
                                }
                            />

                            <Bar
                                dataKey="value"
                                radius={[6, 6, 0, 0]}
                            />

                        </BarChart>

                    </ResponsiveContainer>

                </div>

            </div>

        </div>

    )

}

function Metric({ label, value, highlight }) {

    return (

        <div className={`nor-profit-metric ${highlight ? "nor-profit-highlight" : ""
            }`}>

            <div className="nor-metric-label">
                {label}
            </div>

            <div className="nor-metric-value">
                {value}
            </div>

        </div>

    )

}