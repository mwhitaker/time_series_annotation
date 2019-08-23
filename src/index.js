// line chart code: https://bl.ocks.org/d3noob/402dd382a51a4f6eea487f9a35566de0
// annotation code adapted from: https://bl.ocks.org/susielu/63269cf8ec84497920f2b7ef1ac85039


const local = require('./localMessage.js');
const ut = require('./utils.js');
const d3 = Object.assign(
  {},
  require('d3'),
  require('d3-svg-annotation'),
  require('d3-scale'),
  require('d3-transition'),
  require('d3-axis')
);
const viz = require('@google/dscc-scripts/viz/initialViz.js');
const dscc = require('@google/dscc');
const moment = require('moment');

function sortByDateAscending(a, b) {
  return a.date - b.date;
}
export const LOCAL = true;

function click(d, message) {
  // console.log(d);
  // console.log(message);
  const FILTER = dscc.InteractionType.FILTER;
  const actionId = 'onClick';
  const dimIds = message.fields.date.map(d => d.id);
  let selected = new Set();

  if (message.interactions.onClick.value.data !== undefined) {
    const selVals = message.interactions[actionId].value.data.values.map(d =>
      JSON.stringify(d)
    );
    // console.log('heat selVals', selVals)
    selected = new Set(selVals);
    const clickData = JSON.stringify(d.dimensions);
    // console.log('heat clickData', clickData)
    if (selected.has(clickData)) {
      selected.delete(clickData);
    } else {
      selected.add(clickData);
    }
  } else {
    const filterData = {
      concepts: dimIds,
      values: [d.dimensions],
    };
    // console.log('filterData1: ', filterData);
    dscc.sendInteraction(actionId, FILTER, filterData);
    return;
  }

  if (selected.size > 0) {
    const filterData = {
      concepts: dimIds,
      values: Array.from(selected).map(d => JSON.parse(d)),
    };
    // console.log('filterData2: ', filterData);
    dscc.sendInteraction(actionId, FILTER, filterData);
  } else {
    dscc.clearInteraction(actionId, FILTER);
  }
}

const drawViz = data => {

  const margin = { top: 20, bottom: 30, left: 50, right: 20 };
  const height = dscc.getHeight() - margin.top - margin.bottom;
  const width = dscc.getWidth() - margin.right - margin.left;
  const svgHeight = height - margin.top - margin.bottom;
  const svgWidth = width - margin.left - margin.right;

  const header = data.fields.arbitraryMetric.map(d => d.name);

  if (
    svgHeight < 0 ||
    svgWidth < 0 ||
    width - margin.left < 0 ||
    height - margin.top < 0
  ) {
    ut.onError(ut.SVG_TOO_SMALL, ut.C_SVG_TOO_SMALL);
    return;
  }
  let style = {
    lineColor:
      data.style.lineColor.value !== undefined
        ? data.style.lineColor.value.color
        : data.style.lineColor.defaultValue,
    lineWeight:
      data.style.lineWeight.value !== undefined
        ? data.style.lineWeight.value
        : data.style.lineWeight.defaultValue,
    annotRadius:
      data.style.annotRadius.value !== undefined
        ? data.style.annotRadius.value
        : data.style.annotRadius.defaultValue,
    annotColor:
      data.style.annotColor.value !== undefined
        ? data.style.annotColor.value.color
        : data.style.annotColor.defaultValue,
    annotFill:
      data.style.annotFill.value !== undefined
        ? data.style.annotFill.value
        : data.style.annotFill.defaultValue,
    annotXoffset:
      data.style.annotXoffset.value !== undefined
        ? data.style.annotXoffset.value
        : data.style.annotXoffset.defaultValue,
    annotYoffset:
      data.style.annotYoffset.value !== undefined
        ? data.style.annotYoffset.value
        : data.style.annotYoffset.defaultValue
  };

  // console.log(style)

  var parseTime = d3.timeParse("%Y%m%d");
  var _x = d3.scaleTime().range([0, width]);
  var _y = d3.scaleLinear().range([height, 0]);

  var valueline = d3.line().x(function (d) {
    return _x(d.date);
  }).y(function (d) {
    return _y(d.close);
  });

  d3.select('body')
    .selectAll('svg')
    .remove();

  var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  svg.append('text')
    .text(header[0])
    .attr("transform", "translate(" + 10 + "," + 0 + ")");

  var vizData = data.tables.DEFAULT.map(d => {
    return {
      date: moment(d.date[0], 'YYYY-MM-DD'),
      dateStr: d.date[0],
      year: moment(d.date[0], 'YYYY-MM-DD').format('YYYY'),
      close: d.arbitraryMetric[0],
      annotation: d.annotation ? d.annotation[0] : null
    };
  });
  vizData = vizData.sort(sortByDateAscending);


  // console.log('after: ', data)
  _x.domain(d3.extent(vizData, function (d) {
    return d.date;
  }));
  _y.domain([0, d3.max(vizData, function (d) {
    return d.close;
  })]);

  svg.append("path").data([vizData]).attr("fill", "none").attr("stroke", style.lineColor).attr("stroke-width", style.lineWeight + "px").attr("d", valueline);

  svg.append("g").attr("class", "x-axis").attr("transform", "translate(0," + height + ")").call(d3.axisBottom(_x));

  svg.append("g").call(d3.axisLeft(_y));

  var labelData = vizData.filter(x => x.annotation).map(function (l) {
    l.note = Object.assign({}, l.note, {
      title: l.annotation,
      label: "" + l.date.format('YYYY-MM-DD')
    });
    l.subject = { radius: style.annotRadius };
    l.dx = parseInt(style.annotXoffset);
    l.dy = parseInt(style.annotYoffset);
    l.color = style.annotColor;

    l.data = { date: l.dateStr, close: l.close }

    return l;
  })
  // console.log(labelData)


  window.makeAnnotations = d3.annotation().annotations(labelData).type(d3.annotationCalloutCircle).accessors({
    x: function x(d) {
      return _x(parseTime(d.date));
    },
    y: function y(d) {
      return _y(d.close);
    }
  }).accessorsInverse({
    date: function date(d) {
      return parseTime(_x.invert(d.x));
    },
    close: function close(d) {
      return _y.invert(d.y);
    }
  }).on('subjectover', function (annotation) {
    annotation.type.a.selectAll("g.annotation-connector, g.annotation-note").classed("hidden", false);
  }).on('subjectout', function (annotation) {
    annotation.type.a.selectAll("g.annotation-connector, g.annotation-note").classed("hidden", true);
  }).on('subjectclick', (annotation) => {
    const obj = {
      dimensions: [],
      metrics: []
    };
    obj.dimensions.push(annotation.data.date)
    obj.metrics.push(annotation.data.close)
    // date: "20190812", close: 2113
    click(obj, data)
  });


  svg.append("g").attr("class", "annotation-test").call(makeAnnotations);
  svg.selectAll("g.annotation.callout.circle .annotation-subject path").attr("stroke", style.annotColor).attr("fill", style.annotColor).attr("fill-opacity", style.annotFill)

  svg.selectAll("g.annotation-connector, g.annotation-note").classed("hidden", true);

}

const draw = message => {
  d3.select('#error').remove();
  try {
    drawViz(message);
  } catch (err) {
    ut.onError(ut.GENERAL_ERROR);
    console.log(err);
  }
};

// renders locally
if (LOCAL) {
  draw(local.message);
} else {
  dscc.subscribeToData(draw, { transform: dscc.objectTransform });
}