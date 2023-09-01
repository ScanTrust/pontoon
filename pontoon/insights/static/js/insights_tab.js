var Pontoon = (function (my) {
  const nf = new Intl.NumberFormat('en');
  const pf = new Intl.NumberFormat('en', {
    style: 'percent',
    maximumFractionDigits: 2,
  });

  return $.extend(true, my, {
    insights: {
      renderCharts: function () {
        Pontoon.insights.renderActiveUsers();
        Pontoon.insights.renderUnreviewedSuggestionsLifespan();
        Pontoon.insights.renderTimeToReviewSuggestions();
        Pontoon.insights.renderTimeToReviewPretranslatons();
        Pontoon.insights.renderTranslationActivity();
        Pontoon.insights.renderReviewActivity();
        Pontoon.insights.renderPretranslationQuality();
      },
      renderActiveUsers: function () {
        $('#insights canvas.chart').each(function () {
          // Collect data
          var parent = $(this).parents('.active-users-chart');
          var id = parent.attr('id');
          var period = $('.period-selector .active').data('period').toString();
          var active = $('.active-users').data(period)[id];
          var total = $('.active-users').data('total')[id];

          // Clear old canvas content to avoid aliasing
          var canvas = this;
          var context = canvas.getContext('2d');
          var dpr = window.devicePixelRatio || 1;
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.lineWidth = 3 * dpr;

          var x = canvas.width / 2;
          var y = canvas.height / 2;
          var radius = (canvas.width - context.lineWidth) / 2;

          var activeLength = 0;
          if (total !== 0) {
            activeLength = (active / total) * 2;
          }
          var activeStart = -0.5;
          var activeEnd = activeStart + activeLength;
          plot(activeStart, activeEnd, '#7BC876');

          var inactiveLength = 2;
          if (total !== 0) {
            inactiveLength = ((total - active) / total) * 2;
          }
          var inactiveStart = activeEnd;
          var inactiveEnd = inactiveStart + inactiveLength;
          plot(inactiveStart, inactiveEnd, '#5F7285');

          // Update number
          parent.find('.active').html(active);
          parent.find('.total').html(total);

          function plot(start, end, color) {
            context.beginPath();
            context.arc(x, y, radius, start * Math.PI, end * Math.PI);
            context.strokeStyle = color;
            context.stroke();
          }
        });
      },
      renderUnreviewedSuggestionsLifespan: function () {
        var chart = $('#unreviewed-suggestions-lifespan-chart');
        if (chart.length === 0) {
          return;
        }
        var ctx = chart[0].getContext('2d');

        var gradient = ctx.createLinearGradient(0, 0, 0, 160);
        gradient.addColorStop(0, '#4fc4f666');
        gradient.addColorStop(1, 'transparent');

        new Chart(chart, {
          type: 'line',
          data: {
            labels: $('#insights').data('dates'),
            datasets: [
              {
                label: 'Age of unreviewed suggestions',
                data: chart.data('lifespans'),
                backgroundColor: gradient,
                borderColor: ['#4fc4f6'],
                borderWidth: 2,
                pointBackgroundColor: '#4fc4f6',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#4fc4f6',
                pointHoverBorderColor: '#FFF',
              },
            ],
          },
          options: {
            legend: {
              display: false,
            },
            tooltips: {
              borderColor: '#4fc4f6',
              borderWidth: 1,
              caretPadding: 5,
              xPadding: 10,
              yPadding: 10,
              displayColors: false,
              callbacks: {
                label: (item) => nf.format(item.value) + ' days',
              },
            },
            scales: {
              xAxes: [
                {
                  type: 'time',
                  time: {
                    displayFormats: {
                      month: 'MMM',
                    },
                    tooltipFormat: 'MMMM YYYY',
                  },
                  gridLines: {
                    display: false,
                  },
                  ticks: {
                    source: 'data',
                  },
                },
              ],
              yAxes: [
                {
                  gridLines: {
                    display: false,
                  },
                  position: 'right',
                  ticks: {
                    beginAtZero: true,
                    maxTicksLimit: 3,
                    precision: 0,
                    callback: function (value) {
                      return value + ' days';
                    },
                  },
                },
              ],
            },
          },
        });
      },
      renderTimeToReviewSuggestions: function () {
        var chart = $('#time-to-review-suggestions-chart');
        if (chart.length === 0) {
          return;
        }
        var ctx = chart[0].getContext('2d');

        var gradient = ctx.createLinearGradient(0, 0, 0, 160);
        gradient.addColorStop(0, '#4fc4f666');
        gradient.addColorStop(1, 'transparent');

        new Chart(chart, {
          type: 'bar',
          data: {
            labels: $('#insights').data('dates'),
            datasets: [
              {
                type: 'line',
                label: 'Current month',
                data: chart.data('time-to-review-suggestions'),
                backgroundColor: gradient,
                borderColor: ['#3e7089'],
                borderWidth: 2,
                pointBackgroundColor: '#3e7089',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#3e7089',
                pointHoverBorderColor: '#FFF',
                order: 2,
                spanGaps: true,
              },
              {
                type: 'line',
                label: '12-month average',
                data: chart.data('time-to-review-suggestions-12-month-avg'),
                borderColor: ['#4fc4f6'],
                borderWidth: 1,
                pointBackgroundColor: '#4fc4f6',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#4fc4f6',
                pointHoverBorderColor: '#FFF',
                order: 1,
                spanGaps: true,
              },
            ],
          },
          options: {
            legend: {
              display: false,
            },
            tooltips: {
              mode: 'index',
              intersect: false,
              borderColor: '#4fc4f6',
              borderWidth: 1,
              caretPadding: 5,
              xPadding: 10,
              yPadding: 10,
              callbacks: {
                label(items, chart) {
                  const { label } = chart.datasets[items.datasetIndex];
                  return `${label}: ${items.value} days`;
                },
              },
            },
            scales: {
              xAxes: [
                {
                  type: 'time',
                  time: {
                    displayFormats: {
                      month: 'MMM',
                    },
                    tooltipFormat: 'MMMM YYYY',
                  },
                  gridLines: {
                    display: false,
                  },
                  offset: true,
                  ticks: {
                    source: 'data',
                  },
                },
              ],
              yAxes: [
                {
                  gridLines: {
                    display: false,
                  },
                  position: 'right',
                  ticks: {
                    beginAtZero: true,
                    maxTicksLimit: 3,
                    precision: 0,
                    callback: (value) => `${value} days`,
                  },
                },
              ],
            },
          },
        });
      },
      renderTimeToReviewPretranslatons: function () {
        var chart = $('#time-to-review-pretranslations-chart');
        if (chart.length === 0) {
          return;
        }
        var ctx = chart[0].getContext('2d');

        var gradient = ctx.createLinearGradient(0, 0, 0, 160);
        gradient.addColorStop(0, '#b3005e66');
        gradient.addColorStop(1, 'transparent');

        new Chart(chart, {
          type: 'bar',
          data: {
            labels: $('#insights').data('dates'),
            datasets: [
              {
                type: 'line',
                label: 'Current month',
                data: chart.data('time-to-review-pretranslations'),
                backgroundColor: gradient,
                borderColor: ['#ff5f9e'],
                borderWidth: 2,
                pointBackgroundColor: '#ff5f9e',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#ff5f9e',
                pointHoverBorderColor: '#FFF',
                order: 2,
                spanGaps: true,
              },
              {
                type: 'line',
                label: '12-month average',
                data: chart.data('time-to-review-pretranslations-12-month-avg'),
                borderColor: ['#b3005e'],
                borderWidth: 1,
                pointBackgroundColor: '#b3005e',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#b3005e',
                pointHoverBorderColor: '#FFF',
                order: 1,
                spanGaps: true,
              },
            ],
          },
          options: {
            legend: {
              display: false,
            },
            tooltips: {
              mode: 'index',
              intersect: false,
              borderColor: '#b3005e',
              borderWidth: 1,
              caretPadding: 5,
              xPadding: 10,
              yPadding: 10,
              callbacks: {
                label(items, chart) {
                  const { label } = chart.datasets[items.datasetIndex];
                  return `${label}: ${items.value} days`;
                },
              },
            },
            scales: {
              xAxes: [
                {
                  type: 'time',
                  time: {
                    displayFormats: {
                      month: 'MMM',
                    },
                    tooltipFormat: 'MMMM YYYY',
                  },
                  gridLines: {
                    display: false,
                  },
                  offset: true,
                  ticks: {
                    source: 'data',
                  },
                },
              ],
              yAxes: [
                {
                  gridLines: {
                    display: false,
                  },
                  position: 'right',
                  ticks: {
                    beginAtZero: true,
                    maxTicksLimit: 3,
                    precision: 0,
                    callback: (value) => `${value} days`,
                  },
                },
              ],
            },
          },
        });
      },
      renderTranslationActivity: function () {
        var chart = $('#translation-activity-chart');
        if (chart.length === 0) {
          return;
        }
        var ctx = chart[0].getContext('2d');

        var gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#7BC87633');
        gradient.addColorStop(1, 'transparent');

        var humanData = chart.data('human-translations') || [];
        var machineryData = chart.data('machinery-translations') || [];
        var newSourcesData = chart.data('new-source-strings') || [];

        var translationActivityChart = new Chart(chart, {
          type: 'bar',
          data: {
            labels: $('#insights').data('dates'),
            datasets: [
              {
                type: 'line',
                label: 'Completion',
                data: chart.data('completion'),
                yAxisID: 'completion-y-axis',
                backgroundColor: gradient,
                borderColor: ['#7BC876'],
                borderWidth: 2,
                pointBackgroundColor: '#7BC876',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#7BC876',
                pointHoverBorderColor: '#FFF',
              },
              humanData.length > 0 && {
                type: 'bar',
                label: 'Human translations',
                data: humanData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#4f7256',
                hoverBackgroundColor: '#4f7256',
                stack: 'translations',
                order: 2,
              },
              machineryData.length > 0 && {
                type: 'bar',
                label: 'Machinery translations',
                data: machineryData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#41554c',
                hoverBackgroundColor: '#41554c',
                stack: 'translations',
                order: 1,
              },
              newSourcesData.length > 0 && {
                type: 'bar',
                label: 'New source strings',
                data: newSourcesData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#272a2f',
                hoverBackgroundColor: '#272a2f',
                stack: 'source-strings',
                order: 3,
                hidden: true,
              },
            ].filter(Boolean), // Filter out empty values
          },
          options: {
            legend: {
              display: false,
            },
            legendCallback: Pontoon.insights.customLegend(chart),
            tooltips: {
              mode: 'index',
              intersect: false,
              borderColor: '#7BC876',
              borderWidth: 1,
              caretPadding: 5,
              xPadding: 10,
              yPadding: 10,
              itemSort: function (a, b) {
                // Dataset order affects stacking, tooltip and
                // legend, but it doesn't work intuitively, so
                // we need to manually sort tooltip items.
                if (a.datasetIndex === 2 && b.datasetIndex === 1) {
                  return 1;
                }
              },
              callbacks: {
                label: function (items, chart) {
                  const human = chart.datasets[1].data[items.index];
                  const machinery = chart.datasets[2].data[items.index];

                  const label = chart.datasets[items.datasetIndex].label;
                  const value = items.yLabel;
                  const base = label + ': ' + nf.format(value);

                  switch (label) {
                    case 'Completion':
                      return label + ': ' + pf.format(value / 100);
                    case 'Human translations':
                    case 'Machinery translations': {
                      const pct = Pontoon.insights.getPercent(
                        value,
                        human + machinery,
                      );
                      return `${base} (${pct} of all translations)`;
                    }
                    default:
                      return base;
                  }
                },
              },
            },
            scales: {
              xAxes: [
                {
                  stacked: true,
                  type: 'time',
                  time: {
                    displayFormats: {
                      month: 'MMM',
                    },
                    tooltipFormat: 'MMMM YYYY',
                  },
                  gridLines: {
                    display: false,
                  },
                  offset: true,
                  ticks: {
                    source: 'data',
                  },
                },
              ],
              yAxes: [
                {
                  id: 'completion-y-axis',
                  position: 'right',
                  scaleLabel: {
                    display: true,
                    labelString: 'COMPLETION',
                    fontColor: '#FFF',
                    fontStyle: 100,
                  },
                  gridLines: {
                    display: false,
                  },
                  ticks: {
                    beginAtZero: true,
                    max: 100,
                    stepSize: 20,
                    callback: function (value) {
                      return pf.format(value / 100);
                    },
                  },
                },
                {
                  stacked: true,
                  id: 'strings-y-axis',
                  position: 'left',
                  scaleLabel: {
                    display: true,
                    labelString: 'STRINGS',
                    fontColor: '#FFF',
                    fontStyle: 100,
                  },
                  gridLines: {
                    display: false,
                  },
                  ticks: {
                    beginAtZero: true,
                    precision: 0,
                  },
                },
              ],
            },
          },
        });

        // Render custom legend
        $('#translation-activity-chart-legend').html(
          translationActivityChart.generateLegend(),
        );
        Pontoon.insights.attachCustomLegendHandler(
          translationActivityChart,
          '#translation-activity-chart-legend .label',
        );
      },
      renderReviewActivity: function () {
        var chart = $('#review-activity-chart');
        if (chart.length === 0) {
          return;
        }
        var ctx = chart[0].getContext('2d');

        var gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#4fc4f688');
        gradient.addColorStop(1, 'transparent');

        var unreviewedData = chart.data('unreviewed') || [];
        var peerApprovedData = chart.data('peer-approved') || [];
        var selfApprovedData = chart.data('self-approved') || [];
        var rejectedData = chart.data('rejected') || [];
        var newSuggestionsData = chart.data('new-suggestions') || [];

        var reviewActivityChart = new Chart(chart, {
          type: 'bar',
          data: {
            labels: $('#insights').data('dates'),
            datasets: [
              {
                type: 'line',
                label: 'Unreviewed',
                data: unreviewedData,
                yAxisID: 'strings-y-axis',
                backgroundColor: gradient,
                borderColor: ['#4fc4f6'],
                borderWidth: 2,
                pointBackgroundColor: '#4fc4f6',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#4fc4f6',
                pointHoverBorderColor: '#FFF',
              },
              peerApprovedData.length > 0 && {
                type: 'bar',
                label: 'Peer-approved',
                data: peerApprovedData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#3e7089',
                hoverBackgroundColor: '#3e7089',
                stack: 'review-actions',
                order: 3,
              },
              selfApprovedData.length > 0 && {
                type: 'bar',
                label: 'Self-approved',
                data: selfApprovedData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#385465',
                hoverBackgroundColor: '#385465',
                stack: 'review-actions',
                order: 2,
              },
              rejectedData.length > 0 && {
                type: 'bar',
                label: 'Rejected',
                data: rejectedData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#843650',
                hoverBackgroundColor: '#843650',
                stack: 'review-actions',
                order: 1,
              },
              newSuggestionsData.length > 0 && {
                type: 'bar',
                label: 'New suggestions',
                data: chart.data('new-suggestions'),
                yAxisID: 'strings-y-axis',
                backgroundColor: '#272a2f',
                hoverBackgroundColor: '#272a2f',
                stack: 'new-suggestions',
                order: 4,
                hidden: true,
              },
            ].filter(Boolean), // Filter out empty values
          },
          options: {
            legend: {
              display: false,
            },
            legendCallback: Pontoon.insights.customLegend(chart),
            tooltips: {
              mode: 'index',
              intersect: false,
              borderColor: '#4fc4f6',
              borderWidth: 1,
              caretPadding: 5,
              xPadding: 10,
              yPadding: 10,
              itemSort: function (a, b) {
                // Dataset order affects stacking, tooltip and
                // legend, but it doesn't work intuitively, so
                // we need to manually sort tooltip items.
                if (
                  (a.datasetIndex === 3 && b.datasetIndex === 2) ||
                  (a.datasetIndex === 3 && b.datasetIndex === 1) ||
                  (a.datasetIndex === 2 && b.datasetIndex === 1)
                ) {
                  return 1;
                }
              },
              callbacks: {
                label: function (items, chart) {
                  const label = chart.datasets[items.datasetIndex].label;
                  const value = items.yLabel;
                  const base = label + ': ' + nf.format(value);

                  if (chart.datasets.length < 4) {
                    return base;
                  }

                  const peerApproved = chart.datasets[1].data[items.index];
                  const selfApproved = chart.datasets[2].data[items.index];
                  const rejected = chart.datasets[3].data[items.index];

                  switch (label) {
                    case 'Self-approved': {
                      const pct = Pontoon.insights.getPercent(
                        value,
                        peerApproved + selfApproved,
                      );
                      return `${base} (${pct} of all approvals)`;
                    }
                    case 'Peer-approved':
                    case 'Rejected': {
                      const pct = Pontoon.insights.getPercent(
                        value,
                        peerApproved + rejected,
                      );
                      return `${base} (${pct} of peer-reviews)`;
                    }
                    default:
                      return base;
                  }
                },
              },
            },
            scales: {
              xAxes: [
                {
                  stacked: true,
                  type: 'time',
                  time: {
                    displayFormats: {
                      month: 'MMM',
                    },
                    tooltipFormat: 'MMMM YYYY',
                  },
                  gridLines: {
                    display: false,
                  },
                  offset: true,
                  ticks: {
                    source: 'data',
                  },
                },
              ],
              yAxes: [
                {
                  stacked: true,
                  id: 'strings-y-axis',
                  position: 'left',
                  scaleLabel: {
                    display: true,
                    labelString: 'STRINGS',
                    fontColor: '#FFF',
                    fontStyle: 100,
                  },
                  gridLines: {
                    display: false,
                  },
                  ticks: {
                    beginAtZero: true,
                    precision: 0,
                  },
                },
              ],
            },
          },
        });

        // Render custom legend
        $('#review-activity-chart-legend').html(
          reviewActivityChart.generateLegend(),
        );
        Pontoon.insights.attachCustomLegendHandler(
          reviewActivityChart,
          '#review-activity-chart-legend .label',
        );
      },
      renderPretranslationQuality: function () {
        var chart = $('#pretranslation-quality-chart');
        if (chart.length === 0) {
          return;
        }
        var ctx = chart[0].getContext('2d');

        var gradient_approval = ctx.createLinearGradient(0, 0, 0, 400);
        gradient_approval.addColorStop(0, '#FFACFC33');
        gradient_approval.addColorStop(1, 'transparent');

        var gradient_chrf = ctx.createLinearGradient(0, 0, 0, 400);
        gradient_chrf.addColorStop(0, '#F148FB33');
        gradient_chrf.addColorStop(1, 'transparent');

        var approvedData = chart.data('approved') || [];
        var rejectedData = chart.data('rejected') || [];
        var newData = chart.data('new') || [];

        var pretranslationQualityChart = new Chart(chart, {
          type: 'bar',
          data: {
            labels: $('#insights').data('dates'),
            datasets: [
              {
                type: 'line',
                label: 'Approval rate',
                data: chart.data('approval-rate'),
                yAxisID: 'approval-rate-y-axis',
                backgroundColor: gradient_approval,
                borderColor: ['#c6c1f0'],
                borderWidth: 2,
                pointBackgroundColor: '#c6c1f0',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#c6c1f0',
                pointHoverBorderColor: '#FFF',
                spanGaps: true,
              },
              {
                type: 'line',
                label: 'chrf++ score',
                data: chart.data('chrf-score'),
                yAxisID: 'approval-rate-y-axis',
                backgroundColor: gradient_chrf,
                borderColor: ['#8074a8'],
                borderWidth: 2,
                pointBackgroundColor: '#8074a8',
                pointHitRadius: 10,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#8074a8',
                pointHoverBorderColor: '#FFF',
                spanGaps: true,
              },
              approvedData.length > 0 && {
                type: 'bar',
                label: 'Approved',
                data: approvedData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#c46487',
                hoverBackgroundColor: '#c46487',
                stack: 'reviewed-pretranslations',
                order: 2,
              },
              rejectedData.length > 0 && {
                type: 'bar',
                label: 'Rejected',
                data: rejectedData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#ffbed1',
                hoverBackgroundColor: '#ffbed1',
                stack: 'reviewed-pretranslations',
                order: 1,
              },
              newData.length > 0 && {
                type: 'bar',
                label: 'New pretranslations',
                data: newData,
                yAxisID: 'strings-y-axis',
                backgroundColor: '#272a2f',
                hoverBackgroundColor: '#272a2f',
                stack: 'new-pretranslations',
                order: 3,
                hidden: true,
              },
            ].filter(Boolean), // Filter out empty values
          },
          options: {
            legend: {
              display: false,
            },
            legendCallback: Pontoon.insights.customLegend(chart),
            tooltips: {
              mode: 'index',
              intersect: false,
              borderColor: '#FFACFC',
              borderWidth: 1,
              caretPadding: 5,
              xPadding: 10,
              yPadding: 10,
              itemSort: function (a, b) {
                // Dataset order affects stacking, tooltip and
                // legend, but it doesn't work intuitively, so
                // we need to manually sort tooltip items.
                if (
                  (a.datasetIndex === 3 && b.datasetIndex === 2) ||
                  (a.datasetIndex === 3 && b.datasetIndex === 1) ||
                  (a.datasetIndex === 2 && b.datasetIndex === 1)
                ) {
                  return 1;
                }
              },
              callbacks: {
                label: function (items, chart) {
                  const label = chart.datasets[items.datasetIndex].label;
                  const value = items.yLabel;
                  const base = label + ': ' + nf.format(value);

                  switch (label) {
                    case 'Approval rate':
                      return label + ': ' + pf.format(value / 100);
                    default:
                      return base;
                  }
                },
              },
            },
            scales: {
              xAxes: [
                {
                  stacked: true,
                  type: 'time',
                  time: {
                    displayFormats: {
                      month: 'MMM',
                    },
                    tooltipFormat: 'MMMM YYYY',
                  },
                  gridLines: {
                    display: false,
                  },
                  offset: true,
                  ticks: {
                    source: 'data',
                  },
                },
              ],
              yAxes: [
                {
                  id: 'approval-rate-y-axis',
                  position: 'right',
                  scaleLabel: {
                    display: true,
                    labelString: 'APPROVAL RATE',
                    fontColor: '#FFF',
                    fontStyle: 100,
                  },
                  gridLines: {
                    display: false,
                  },
                  ticks: {
                    beginAtZero: true,
                    max: 100,
                    stepSize: 20,
                    callback: function (value) {
                      return pf.format(value / 100);
                    },
                  },
                },
                {
                  stacked: true,
                  id: 'strings-y-axis',
                  position: 'left',
                  scaleLabel: {
                    display: true,
                    labelString: 'STRINGS',
                    fontColor: '#FFF',
                    fontStyle: 100,
                  },
                  gridLines: {
                    display: false,
                  },
                  ticks: {
                    beginAtZero: true,
                    precision: 0,
                  },
                },
              ],
            },
          },
        });

        // Render custom legend
        $('#pretranslation-quality-chart-legend').html(
          pretranslationQualityChart.generateLegend(),
        );
        Pontoon.insights.attachCustomLegendHandler(
          pretranslationQualityChart,
          '#pretranslation-quality-chart-legend .label',
        );
      },
      getPercent: function (value, total) {
        const n = value / total;
        return pf.format(isFinite(n) ? n : 0);
      },
    },
  });
})(Pontoon || {});