var scatterNodes, label, networkNodes, networkLinks;
var fullData;


d3.csv('data/kdrama_list.csv')
        .then(data => {
            preprocess(data);
            fullData = data;  // 원본 데이터를 전역 변수에 저장
            makeSlider();
   
        })
    .catch(error => {
            console.error(error);
    });

function preprocess(data) {
    var nodes = [];
            var links = [];
            var networkIndex = {};


            // Limit the number of dramas
            var limitedData = data.slice(0, 50);

            // Create nodes for dramas and networks, and links between them
            limitedData.forEach((item, index) => {
                var dramaId = "drama_" + index;
            
                // Add a node for the drama
                nodes.push({ id: dramaId, name: item.Name, type: "drama" });
            
                // Get networks of the drama
                var networks = [];
                if (typeof item.Network === 'string') {
                    networks = item.Network.split(', ');
                } else if (Array.isArray(item.Network)) {
                    networks = item.Network;
                }
            
                // For each network, add a node (if not already added) and a link
                networks.forEach(network => {
                    var networkId;
            
                    // If the network is not in the index, add a node for it
                    if (!networkIndex.hasOwnProperty(network)) {
                        networkId = "network_" + Object.keys(networkIndex).length;
                        nodes.push({ id: networkId, name: network, type: "network" });
                        networkIndex[network] = networkId;
                    } else {
                        networkId = networkIndex[network];
                    }
            
                    // Add a link between the drama and the network
                    links.push({ source: dramaId, target: networkId });
                });
            });

            var graphData = { nodes: nodes, links: links };
            // 데이터 전처리
            data.forEach(function(d) {
                if (typeof d.Episode === 'string') {
                    d.Episode = +d.Episode.replace(' episodes', ''); 
                }                d.Score = +d.Score; 
                d.Rank = +d.Rank + 1;
                if (typeof d.Genre === 'string') {
                    d.Genre = d.Genre.split(",");  // split genres by comma
                }
                if (typeof d.Network === 'string') {
                    d.Network = d.Network.split(",");  // split networks by comma
                }
                d.Score = +d.Score; // convert score to number
            });                    

            // Flatten data:
            var flatData = data.flatMap(function(d) {
                return d.Genre.flatMap(function(genre) {
                    return d.Network.map(function(network) {
                        return {
                            Index: d.Index,
                            Name: d.Name,
                            Year: d.Year,
                            Genre: genre,
                            MainCast: d.MainCast,
                            Sinopsis: d.Sinopsis,
                            Score: d.Score,
                            ContentRating: d.ContentRating,
                            Tags: d.Tags,
                            Network: network,
                            imgurl: d.imgurl,
                            Episode: d.Episode
                        };
                    });
                });
            });                       
                                
            var genres = d3.group(flatData, d => d.Genre.replace(' ', ''));
            var genreData = Array.from(genres, ([key, value]) => ({
                Genre: key,
                Count: value.length,
                AvgScore: d3.mean(value, d => d.Score)
            }));
    makeScatter(data); 
    makeNetwork(graphData);
    makeBubble(genreData); 
}

function makeSlider() {
    var slider = document.getElementById('slider');
    var valueLower = document.getElementById('slider-value-lower');
    var valueUpper = document.getElementById('slider-value-upper');

    noUiSlider.create(slider, {
        start: [1995, 2023],
        connect: true,
        range: {
            'min': 1995,
            'max': 2023
        }
    });
    valueLower.innerHTML = 1995;
    valueUpper.innerHTML = 2023;

    slider.noUiSlider.on('update', function(values,handle){
        var lowerValue = Math.round(values[0]);
        var upperValue = Math.round(values[1]);
        valueLower.innerHTML = lowerValue;
        valueUpper.innerHTML = upperValue;
    });
    slider.noUiSlider.on('change', function(values, handle) {
        var lowerValue = Math.round(values[0]);
        var upperValue = Math.round(values[1]);
        valueLower.innerHTML = lowerValue;
        valueUpper.innerHTML = upperValue;

        // 이 부분에서 fullData를 사용
        var filteredData = fullData.filter(function(d) {
            return d.Year >= lowerValue && d.Year <= upperValue;
        });
        let elements = document.getElementsByClassName('tooltip');
        while(elements.length > 0){
            elements[0].parentNode.removeChild(elements[0]);
        }
        d3.select('.tooltip').remove();
        d3.select('.network').remove();
        d3.select('.bubble').remove();
        d3.select('.scatter').remove();
        // 필터링된 데이터로 시각화를 다시 그립니다.
        preprocess(filteredData);

    });
}

function makeBubble(genreData){
    let width = 1600;
    let height = 700;
    // Sort by count and select top 10
    genreData.sort((a, b) => b.Count - a.Count);
    genreData = genreData.slice(0, 10);
    // Setup SVG
    var svg = d3.select("body").append("svg")
        .attr('class', 'bubble')
        .attr("width", width)
        .attr("height", height);
    
    svg.append("rect")
        .attr("rx", 30)
        .attr("ry", 30)
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "#E2EBF3");

    // Create a scale for the circle size
    var radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(genreData, d => d.Count)])
        .range([10, 50]);  // Adjust as needed

    // Create a color scale
    var colorScale = d3.scaleOrdinal()
        .domain(genreData.map(d => d.Genre))
        .range(["#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4", "#009688", "#4CAF50"]);  // Or use another color scheme

    // Create a simulation for the bubbles
    var simulation = d3.forceSimulation(genreData)
        .force("x", d3.forceX(width / 2).strength(0.05))  // Attract to center
        .force("y", d3.forceY(height / 2).strength(0.05))  // Attract to center
        .force("collide", d3.forceCollide(d => radiusScale(d.Count*6.4)))  // Avoid overlap
        .on("tick", ticked);  // Run simulation

    var tooltip = d3.select("body")
        .append("div")
        .attr('class', 'tooltip')
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "white")
        .style("padding", "5px");
        
    function ticked() {
        var u = svg.selectAll('.genre-bubble')
            .data(genreData);

        var enter = u.enter()
            .append('g')
            .attr('class', 'genre-bubble')
            .on("mouseover", function(event, d) {  // event argument is added
                tooltip.style("visibility", "visible");
                tooltip.text(d.Genre + ": " + d.Count);
            })
            .on("mousemove", function(event) {  // event argument is added
                tooltip.style("top", (event.pageY-10)+"px")  // use event instead of d3.event
                    .style("left",(event.pageX+10)+"px");  // use event instead of d3.event
            })
            .on("mouseout", function(){return tooltip.style("visibility", "hidden");});

        enter.append('circle')
            .attr('r', d => radiusScale(d.Count*6))
            .attr('fill', d => colorScale(d.Genre));

        enter.append('text')
            .attr("text-anchor", "middle")
            .text(d => d.Genre)
            .style('fill', 'white')
            .style('font-size', '16px');

        u.merge(enter)
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

        u.exit().remove();
    }
    svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 20)  // Adjust as needed
    .style("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", "24px")  // Adjust as needed
    .style("fill", "#000")  // Adjust as needed
    .text("Bubble Chart About the genre");  // Your title
}

function makeNetwork(graphData) {
    let width = 930;
    let height = 800;
    let radius = 30;

    var svg = d3.select("body").append("svg")
        .attr('class', 'network')
        .attr("width", width)
        .attr("height", height);
    // Create a simulation for the nodes
    var simulation = d3.forceSimulation(graphData.nodes)
        .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(60))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width*0.45, height*0.6))
        .force("collision", d3.forceCollide().radius(30));
    
    svg.append("rect")
        .attr("rx", 30)
        .attr("ry", 30)
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "#DEE8F1");
    // Create links
    networkLinks = svg.append("g")
        .selectAll("line")
        .data(graphData.links)
        .enter().append("line")
        .style("stroke", "#aaa");

    // Create SVG circles for nodes
    networkNodes = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(graphData.nodes)
        .enter().append("circle")
        .attr("r", 25)
        .attr("fill", function(d) { 
            return d.type === 'drama' ? "#2B8FEF" : "#ff7f0e"; 
        })
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Add labels for nodes
    label = svg.append("g")
        .selectAll("text")
        .data(graphData.nodes)
        .enter()
        .append("text")
        .text(d => d.name)
        .style("text-anchor", "middle")
        .style("fill", "#555")
        .style("font-family", "Arial")
        .style("font-size", 12);

    // Update the positions of nodes and links
    simulation.on("tick", function() {
        networkLinks.attr("x1", function(d) { return d.source.x = Math.max(radius, Math.min(width - radius, d.source.x)); })
            .attr("y1", function(d) { return d.source.y = Math.max(radius, Math.min(height - radius, d.source.y)); })
            .attr("x2", function(d) { return d.target.x = Math.max(radius, Math.min(width - radius, d.target.x)); })
            .attr("y2", function(d) { return d.target.y = Math.max(radius, Math.min(height - radius, d.target.y)); });

        networkNodes
            .attr("cx", function(d) { return d.x = Math.max(radius, Math.min(width - radius, d.x)); })
            .attr("cy", function(d) { return d.y = Math.max(radius, Math.min(height - radius, d.y)); });

        label.attr("x", d => d.x)
            .attr("y", d => d.y);
    });
    networkNodes.on('click', function(event, d) {
        let connectedNodes = networkLinks.data().filter(function(link) {
            return link.source.id === d.id || link.target.id === d.id;
        }).map(function(link) {
            return link.source.id === d.id ? link.target.id : link.source.id;
        });
    
        networkNodes.style('opacity', function(n) {
            return n.id === d.id || connectedNodes.includes(n.id) ? 1 : 0.2;
        });
    
        scatterNodes.style('opacity', function(n) {
            return n.Name === d.name || connectedNodes.includes(n.Name) ? 1 : 0.2;
        });
    
        networkLinks.style('stroke', function(l) {
            return l.source.id === d.id || l.target.id === d.id ? '#333' : "#aaa";
        });
        label.style('opacity', function(n) {
            return n.id === d.id || connectedNodes.includes(n.id) ? 1 : 0.2;
        });
        event.stopPropagation();    
    });
    
    // Define drag event functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.01).restart();
        d.fx = d.x;
        d.fy = d.y;

        let connectedNodes = networkLinks.data().filter(function(link) {
            return link.source.id === d.id || link.target.id === d.id;
        }).map(function(link) {
            return link.source.id === d.id ? link.target.id : link.source.id;
        });
    
        networkNodes.style('opacity', function(n) {
            return n.id === d.id || connectedNodes.includes(n.id) ? 1 : 0.2;
        });
    
        scatterNodes.style('opacity', function(n) {
            return n.Name === d.name || connectedNodes.includes(n.Name) ? 1 : 0.2;
        });
    
        networkLinks.style('stroke', function(l) {
            return l.source.id === d.id || l.target.id === d.id ? '#333' : "#aaa";
        });
        label.style('opacity', function(n) {
            return n.id === d.id || connectedNodes.includes(n.id) ? 1 : 0.2;
        });
        event.stopPropagation();   
    }
    svg.on('click', function() {
        // 모든 점의 투명도를 원래대로 되돌림
        networkNodes.style('opacity', 1);
        networkLinks.style('opacity', 1);
        scatterNodes.style('opacity', 1);
        label.style('opacity', 1);
    });

    function dragged(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        scatterNodes.style('opacity', 1);

        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        // Reset the style of the node being dragged
        d3.select(this).select('circle').style('stroke', null);
        // Reset the style of the links connected to this node
        networkLinks.style('stroke', "#aaa");
        label.style('opacity', 1);

        // Reset opacity for all nodes
        networkNodes.style('opacity', 1);
    }
    svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)  // Adjust as needed
    .style("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", "24px")  // Adjust as needed
    .style("fill", "#000")  // Adjust as needed
    .text("Network about the Top 50 Drama and Platform");  // Your title
}

function makeScatter(dramaData) {
    

    dramaData = dramaData.slice(0, 50);

    var margin = { top: 30, right: 30, bottom: 50, left: 60 },
    width = 650 - margin.left - margin.right,
    height = 800 - margin.top - margin.bottom;
    var svgContainer = d3.select("body").append("svg")
            .attr('class', 'scatter')
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);
            
    var svg = svgContainer.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
           
    var x = d3.scaleLinear()
        .domain([d3.min(dramaData, function(d) { return d.Episode; }) - 5, d3.max(dramaData, function(d) { return d.Episode; }) + 5])
        .range([ 0, width]);

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    var y = d3.scaleLinear()
        .domain([d3.min(dramaData, function(d) { return d.Rank; }) * 0.95, d3.max(dramaData, function(d) { return d.Rank; }) * 1.05])
        .range([1, height]);
    var color = d3.scaleSequential()
        .domain([d3.max(dramaData, function(d) { return d.Rank+75; }), d3.min(dramaData, function(d) { return d.Rank; })])
        .interpolator(d3.interpolateBlues);

    var simulation = d3.forceSimulation(dramaData)
        .force('x', d3.forceX(function(d) { return x(d.Episode); }).strength(1))
        .force('y', d3.forceY(function(d) { return y(d.Rank); }).strength(1))
        .force('collision', d3.forceCollide().radius(10))
        .stop();

    for (var i = 0; i < 120; ++i) simulation.tick();
    // Create a tooltip
    var Tooltip = d3.select("body")
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style("position", "absolute") // Add absolute positioning
        .style("pointer-events", "none"); // Ignore mouse events

    // Three function that change the tooltip when user hover / move / leave a cell
    var mouseover = function(d) {
        Tooltip.style("opacity", 1)
    }
    var mousemove = function(event, d) {
        Tooltip
            .html("Drama: " + d.Name + "<br>" + "Score: " + d.Score + "<br>" + "Rank: " + d.Rank)
            .style("left", (d3.pointer(event)[0]+70) + "px")
            .style("top", (d3.pointer(event)[1]+10) + "px")
    }
    var mouseleave = function(d) {
        Tooltip.style("opacity", 0)
    }
    svg.append("g")
        .call(d3.axisLeft(y));

    scatterNodes = svg.append('g')
        .selectAll("dot")
        .data(dramaData)
        .enter()
        .append("circle")
            .attr("cx", function (d) { return x(d.Episode); } )
            .attr("cy", function(d) { return d.y; })
            .attr("r", 8)
            .style("fill", function(d) { return color(d.Rank); })
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);
    
        scatterNodes.on('click', function(event, d) {
            scatterNodes.style('opacity', function(n) {
                return n === d ? 1 : 0.2;
            });
        
            let connectedNodes = networkLinks.data().filter(function(link) {
                return link.source.name === d.Name || link.target.name === d.Name;
            }).map(function(link) {
                return link.source.name === d.Name ? link.target.name : link.source.name;
            });
        
            networkNodes.style('opacity', function(n) {
                return n.name === d.Name || connectedNodes.includes(n.name) ? 1 : 0.2;
            });
        
            networkLinks.style('stroke', function(l) {
                return l.source.name === d.Name || l.target.name === d.Name ? '#333' : "#aaa";
            });
            label.style('opacity', function(n) {
                return n.name === d.Name || connectedNodes.includes(n.name) ? 1 : 0.2;
            });
            event.stopPropagation();    
        });
        

    svgContainer.on('click', function() {
        // 모든 점의 투명도를 원래대로 되돌림
        scatterNodes.style('opacity', 1);
        networkNodes.style('opacity', 1);
        networkLinks.style('opacity', 1);
        label.style('opacity', 1);
    });
    // Add X axis label
    svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 40) // Adjust as needed
    .style("text-anchor", "middle")
    .text("Episode");

    // Add Y axis label
    svg.append("text")
    .attr("x", - (height / 2))
    .attr("y", - margin.left / 2) // Adjust as needed
    .style("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .text("Rank");


    svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)  // Adjust as needed
    .style("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("font-size", "24px")  // Adjust as needed
    .style("fill", "#000")  // Adjust as needed
    .text("Scatter about the Top 50 Drama");  // Your title

}