/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9936842105263158, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "api_authentication/api/money-receipts-47"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/inventory-42"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/expenses-46"], "isController": false}, {"data": [0.92, 500, 1500, "api_authentication/api/auth/login-53"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/branches-56"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/returns-49"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/invoices-51"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/branches-54"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/settings-57"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/inventory/batches-44"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/settings-55"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/settings-52"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/products-43"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/customers-50"], "isController": false}, {"data": [0.98, 500, 1500, "api_authentication/api/products-40"], "isController": false}, {"data": [0.98, 500, 1500, "api_authentication/api/reports-39"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/categories-41"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/invoices-48"], "isController": false}, {"data": [1.0, 500, 1500, "api_authentication/api/categories-45"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 475, 0, 0.0, 65.12421052631574, 5, 573, 16.0, 284.0, 295.2, 560.48, 50.70993914807302, 71.52457597149566, 32.750864070673636], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["api_authentication/api/money-receipts-47", 25, 0, 0.0, 13.84, 7, 19, 14.0, 18.400000000000002, 19.0, 19.0, 2.8335033435339456, 2.2164415802448145, 1.8456511036495522], "isController": false}, {"data": ["api_authentication/api/inventory-42", 25, 0, 0.0, 38.88000000000001, 20, 64, 38.0, 57.60000000000001, 62.8, 64.0, 2.8315777551251555, 7.7287693609129, 1.8167447120285423], "isController": false}, {"data": ["api_authentication/api/expenses-46", 25, 0, 0.0, 13.960000000000003, 6, 33, 14.0, 21.800000000000004, 29.999999999999993, 33.0, 2.8367184840576423, 0.9418791841597639, 1.8145025459548394], "isController": false}, {"data": ["api_authentication/api/auth/login-53", 25, 0, 0.0, 347.12, 277, 573, 293.0, 569.2, 572.4, 573.0, 2.727768685215494, 1.6622340425531916, 1.8742754364429899], "isController": false}, {"data": ["api_authentication/api/branches-56", 25, 0, 0.0, 39.239999999999995, 6, 291, 12.0, 140.60000000000028, 269.09999999999997, 291.0, 2.834467120181406, 1.97914452239229, 1.8130624645691609], "isController": false}, {"data": ["api_authentication/api/returns-49", 25, 0, 0.0, 14.559999999999999, 6, 32, 14.0, 21.400000000000002, 28.999999999999993, 32.0, 2.8335033435339456, 0.6890061841210472, 1.806911800124674], "isController": false}, {"data": ["api_authentication/api/invoices-51", 25, 0, 0.0, 43.92, 7, 293, 15.0, 239.80000000000015, 290.0, 293.0, 2.8347885247760516, 12.277624128302527, 1.8132680505159313], "isController": false}, {"data": ["api_authentication/api/branches-54", 25, 0, 0.0, 64.96, 6, 298, 14.0, 285.4, 294.4, 298.0, 2.8347885247760516, 1.979368940639528, 1.7053024719355934], "isController": false}, {"data": ["api_authentication/api/settings-57", 25, 0, 0.0, 95.44000000000001, 5, 380, 17.0, 320.20000000000016, 373.4, 380.0, 2.835431552682318, 1.4370986092208233, 1.8136793623114438], "isController": false}, {"data": ["api_authentication/api/inventory/batches-44", 25, 0, 0.0, 55.080000000000005, 11, 290, 17.0, 281.6, 288.2, 290.0, 2.8399409292286717, 10.38353402249233, 1.8442975761104168], "isController": false}, {"data": ["api_authentication/api/settings-55", 25, 0, 0.0, 72.67999999999999, 5, 490, 15.0, 284.0, 429.09999999999985, 490.0, 2.8347885247760516, 1.436772699569112, 1.8132680505159313], "isController": false}, {"data": ["api_authentication/api/settings-52", 25, 0, 0.0, 58.76000000000001, 6, 290, 15.0, 285.4, 288.8, 290.0, 2.835110002268088, 1.4369356359151735, 1.813473683091404], "isController": false}, {"data": ["api_authentication/api/products-43", 25, 0, 0.0, 111.92, 7, 488, 23.0, 323.60000000000014, 450.19999999999993, 488.0, 2.842201000454752, 3.2640902114597545, 1.8207850159163257], "isController": false}, {"data": ["api_authentication/api/customers-50", 25, 0, 0.0, 13.920000000000002, 6, 33, 14.0, 19.800000000000004, 29.39999999999999, 33.0, 2.834145788459358, 4.063013688924158, 1.8183923662283188], "isController": false}, {"data": ["api_authentication/api/products-40", 25, 0, 0.0, 91.64000000000001, 8, 562, 18.0, 293.00000000000006, 483.99999999999983, 562.0, 2.8386510730101056, 3.260013341660043, 1.8739532474168275], "isController": false}, {"data": ["api_authentication/api/reports-39", 25, 0, 0.0, 105.72000000000001, 8, 560, 22.0, 292.20000000000005, 481.0999999999998, 560.0, 2.834467120181406, 4.827451814058957, 1.921015802154195], "isController": false}, {"data": ["api_authentication/api/categories-41", 25, 0, 0.0, 26.000000000000004, 6, 281, 14.0, 42.40000000000012, 219.49999999999986, 281.0, 2.837362387924186, 2.033812492906594, 1.8204561414708886], "isController": false}, {"data": ["api_authentication/api/invoices-48", 25, 0, 0.0, 14.44, 7, 30, 14.0, 19.800000000000004, 27.299999999999994, 30.0, 2.8328611898017, 12.26927673512748, 1.8092687677053825], "isController": false}, {"data": ["api_authentication/api/categories-45", 25, 0, 0.0, 15.279999999999998, 7, 30, 15.0, 24.800000000000004, 28.799999999999997, 30.0, 2.837040399455288, 2.0335816925783026, 1.8839721402632774], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 475, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
