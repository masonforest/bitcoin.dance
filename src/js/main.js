var address = "14xEPWuHC3ybPMfv8iTZZ29UCLTUSoJ8HL";
var socket = new WebSocket('wss://ws.blockchain.info/inv');
var giphyApiKey = "dc6zaTOxFJmzC";
var giphyEnpoint = "http://api.giphy.com/v1/gifs/random";
var giphyTag = "dance";


window.dancing = false;
window.total = 0;

$(function(){
  socket.onopen = function(){
    socket.send(JSON.stringify({"op":"addr_sub", "addr": address}));
  };

  socket.onmessage = function(message){
    var transaction = JSON.parse(message.data);
    window.total = window.total + value(transaction);
    setTotal(window.total);

    if(!window.dancing){
      dance();
    }
  }

  loadInfo();
});

function loadInfo() {
  $.get("https://blockchain.info/q/getreceivedbyaddress/"
    + address, function(total){
      window.total = parseInt(total)
      setTotal(total)
  });
}

function value(transaction) {
  return (_.sum(_.map(transaction.x.out,
    function(v) {
      if(v.addr == address) {
        return v.value
      } else {
        return 0
      }
    }
  )))
}

function setTotal(total) {
  $(".amount-btc").text((total/100000000).toFixed(2))
  $.get("https://blockchain.info/q/24hrprice", function(exchangeRate) {
    $(".amount-usd").text(accounting.formatMoney((total*exchangeRate/100000000)))
  });
}

function dance() {
  window.dancing = true;
  $.get(giphyEnpoint +
        '?api_key=' + giphyApiKey +
        '&tag=' + giphyTag,
    function(res){
      $(".address-container").append("<img class=giphy style=\"display: none\" src=" + res.data.image_url + "></img>")
    }
  )

  $(".address").fadeOut(2000, function(){
    window.dancing = true
    $(".giphy").fadeIn(2000)
    var audio = new Audio('sounds/sandstorm.ogg')
    audio.play()
    audio.ontimeupdate = function(){
      if(audio.currentTime > 27 ) {
        $(".giphy").fadeOut(2000, function() {
          $(".address").fadeIn(2000, function() {
            window.dancing = false
          })
        })
      }
    }
  })
}
