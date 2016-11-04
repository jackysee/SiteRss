var http = require('http');
var url = require('url');
var request = require('request');
var cheerio = require('cheerio');
var jstoxml = require('jstoxml');

var hiConfig = {
    url: 'http://www.ragazine.com.hk/index.php/programmes/menu-hker-life/menu-fuckingagents',
    type: 'audio/x-m4a',
    parse: function(xml){
        var $ = cheerio.load(xml);
        var items = [];
        $('.jsn-article').each(function(index, el){
            var $this = $(this);
            var $title = $this.find('h2').eq(0);
            var title = $title.text().trim();
            var link = $title.find("a").attr("href");
            var pubDate = parseDate(
                $this.find('table').eq(0).find('tr').eq(1).text().trim()
            );
            var links = $this
                .find("[href$=m4a]").not("[href^=http]")
                .map(function(){
                    var $link = $(this);
                    return {
                        url: "http://www.ragazine.com.hk" +  $link.attr('href'),
                        title: $link.text().trim()
                    };
                })
                .each(function(index, obj){
                    items.push({
                        title: title + " " + obj.title,
                        link: "http://www.ragazine.com.hk" +  link,
                        pubDate: pubDate,
                        url: obj.url 
                    });
                });
        });

        return {
            link: hiConfig.url,
            title: $('.blog h2').eq(0).text().trim(),
            items: items
        };
    }

};

var dateRe = /日期：(\d\d\d\d) 年 (\d+) 月 (\d+)/;
function parseDate(str){
    var arr = str.match(dateRe);
    return new Date(
        parseInt(arr[1], 10),
        parseInt(arr[2], 10),
        parseInt(arr[3], 10)
    );
}


function makeRequest(config, callback){
    request(
        {
            url: config.url,
            headers : {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.11; rv:45.0) Gecko/20100101 Firefox/45.0',
                'accept': 'text/html,application/xhtml+xml'
            },
            pool: false,
            followRedirect: true
        },
        function(err, response, xml){
            if(err){
                callback(err, null);
                return;
            }
            var feed = config.parse(xml);
            callback(null, feed);
        }
    );
}


function writeError(err, response){
    response.writeHead(500, {
        "Content-Type":"text/plain;charset=utf-8",
        "Access-Control-Allow-Origin":"*"
    });
    response.write(err + "\n");
    response.end();
}

function writeXmlResponse(rss, response){
    response.writeHead(200, {
        "Content-Type": "text/xml;charset=utf-8",
        "Access-Control-Allow-Origin":"*"
    });
    response.write(rss);
    response.end();
}

function getConfig(request){
    var site = url.parse(request.url, true).query.site;
    if(site == 'hi'){
        return hiConfig;
    }
    return null;
}

function handleRequest(request, response){
    var config = getConfig(request);
    if(!config){
        writeError("no such site", response);
        return;
    }
    makeRequest(config, function(err, feed){
        if(err){
            writeError(err, response);
        }
        else{
            var rss = {
                _name: 'rss',
                _attrs: { version:'2.0' },
                _content:{
                    channel:[
                        {title: feed.title},
                        {link: feed.link}
                    ]
                    .concat(feed.items.map(function(item){
                        return {
                            item: [
                                { title: item.title },
                                { pubDate: function(){ return item.pubDate }},
                                { link: item.link },
                                {
                                    _name: 'enclosure',
                                    _attrs: {
                                        url: item.url,
                                        type: config.type,
                                        length: 1
                                    }
                                }

                            ]
                        };
                    }))
                }
            };
            writeXmlResponse(jstoxml.toXML(rss, {header: true, indent: '  '}), response);
        }
    });
}


var PORT = process.env.PORT || 8888;
var server = http.createServer(handleRequest);

server.listen(PORT, function(){
    console.log("Sever started on %s", PORT);
});    



