
    var list = ["t.me","telegram.org","telesco.pe","telegram.me","tdesktop.com","tx.me","discord.com","discordapp.com","discord.gg","discord.media","discordapp.net","discordstatus.com","youtube.com","googlevideo.com","ytimg.com","youtu.be","ggpht.com","instagram.com","cdninstagram.com","twitter.com","x.com","twimg.com","t.co","facebook.com","fbcdn.net","openai.com","chatgpt.com","medium.com","spotify.com","rutracker.org","ntc.party","notion.so"];
    function FindProxyForURL(url, host) {
      if (isPlainHostName(host) || host === "127.0.0.1" || host === "localhost") return "DIRECT";
      var h = host.toLowerCase();
      for (var i = 0; i < list.length; i++) {
        var d = list[i];
        if (h === d || (h.length > d.length && h.lastIndexOf("." + d) === h.length - d.length - 1)) {
          return "PROXY 127.0.0.1:10808; SOCKS5 127.0.0.1:10808; DIRECT";
        }
      }
      return "DIRECT";
    }
  