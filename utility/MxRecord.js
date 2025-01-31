const dns = require("node:dns")

exports.hasMXRecord = async (email)=> {
    const domain = email.split("@")[1]

    return new Promise((resolve, reject)=> {
        dns.resolve(domain, (err, records)=> {
            if(err) {
                reject(false)
            }
            if(records && records.length > 0) resolve(true)
            else reject(false)
        })
    })
}