const api = {
    get: function(url) {
        return fetch(url).then(res => res.json())
        .catch( e => { console.log(e); })
    },
    post: function(url, body) {
        return fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        }).then( res => res.json())
        .catch( e => { console.log(e); })
    },
    getFragment: function(url) {
        return fetch(url).then(res => res.text())
        .catch( e => { console.log(e); })
    } 
};