const awsFuncs = require('./aws.js');
var Twit = require('twit');
const deepai = require('deepai');
require('dotenv').config()

deepai.setApiKey(process.env.DEEP_AI_KEY);

var secret = { consumer_key: process.env.CONSUMER_KEY, consumer_secret: process.env.CONSUMER_SECRET, access_token_key: process.env.ACCESS_TOKEN, access_token_secret: process.env.ACCESS_TOKEN_SECRET }
var T = new Twit({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

var TwitterPackage = require('twitter');
var Twitter = new TwitterPackage(secret);

let inReplyTo = null //when adding tweet that is reply to another already tweeted
let tweetCount = 0 //# of tweets on a thread
let allMessagesFromDB = [] //documented messages receieved
let usedMessagesFromDB = [] //documented messages receieved and used for story
let messagesReceived = []; //all messages from twitter
let myTwitterKey = process.env.MY_TWITTER_KEY //My personal twitter id

//Splitting the generated text into chunks to fit Twitters guidelines
let prepareTweet = (resp, screen_name) => {
    var chunks = [];
    let tempChunk = ''
    let tempChunkArray = []

    let finishedText = `Inspired by @${screen_name}: \n\n` + resp

    for (let i = 0; i < finishedText.length; i++) {
        tempChunk = tempChunk.concat(finishedText[i])

        //Once a word is completed, push to temp array
        if (finishedText[i] === ' ' || i + 1 === finishedText.length) {
            tempChunkArray.push(tempChunk)
            tempChunk = ''
        }
        //every 260 characters, push to chunks array
        if ((i % 260 == 0 && i != 0) || i === finishedText.length - 1) {
            chunks.push(tempChunkArray.join(''))
            tempChunkArray = []
        }
    }
    tweetText(chunks)
}

//Sending the tweets
let tweetText = (chunks) => {
    Twitter.post('statuses/update', { in_reply_to_status_id: inReplyTo, status: chunks[tweetCount] })
        .then((tweet) => {
            inReplyTo = tweet.id_str
            tweetCount += 1
            if (tweetCount < chunks.length) {
                tweetText(chunks)
            }
        }).catch(error => {
            console.log('error sending tweet')
            console.log(error);
        })
}

//getting all messages that have been put into database
let getMessagesFromDB = async () => {
    await getAllMessagesFromDB()
    await getUsedMessagesFromDB()
    return
}

//Getting a list of all messages stored in db
let getAllMessagesFromDB = async () => {
    return await awsFuncs.getAllItemsFromMain().then(result => {
        allMessagesFromDB = result
        return result
    })
}

//getting a list of messages stored in db that have been used
let getUsedMessagesFromDB = async () => {
    return await awsFuncs.getAllItemsFromUsed().then(result => {
        usedMessagesFromDB = result
        return result
    })
}

let getMessagesFromTwitter = async () => {
    await Twitter.get('direct_messages/events/list', {})
        .then(dm => {
            for (let i = 0; i < dm.events.length; i++) {
                let userId;
                let userConvoCreated = false;

                //Finding the userid of the the person who sent message
                if (dm.events[i].message_create.target.recipient_id == myTwitterKey) {
                    userId = dm.events[i].message_create.sender_id
                } else {
                    userId = dm.events[i].message_create.target.recipient_id
                }

                let conversationObject = {
                    sender: dm.events[i].message_create.sender_id,
                    message: dm.events[i].message_create.message_data.text
                }

                //if conversation has already been created in messagesReceived, 
                for (let k = 0; k < messagesReceived.length; k++) {
                    if (messagesReceived[k].userId === userId) {
                        userConvoCreated = true
                        messagesReceived[k].conversation.push(conversationObject)
                    }
                }

                //if conversation hasnt been created yet, create it and add first message
                if (!userConvoCreated) {
                    let temp = []
                    temp.push(conversationObject)
                    let messageObj = {
                        userId: userId,
                        conversation: temp
                    }
                    messagesReceived.push(messageObj)
                }
            }
        }).catch(error => {
            console.log('error getting messages from twitter: ')
            console.log(error)
        })
}

//Getting story from deepai
let getStory = (userInput, screen_name) => {
    return deepai.callStandardApi("text-generator", {
        text: userInput,
    }).then((resp) => {
        prepareTweet(resp.output, screen_name)
    }).catch(error => {
        console.log("error retrieiving story: ")
        console.log(err)
    })
}

let useIdeas = (possibleIdeas) => {
    if (possibleIdeas.length < 1) { return }

    //Determining if idea has been used before
    for (let i = 0; i < possibleIdeas.length; i++) {
        for (let k = 0; k < usedMessagesFromDB.Items.length; k++) {
            if (possibleIdeas[i].message == usedMessagesFromDB.Items.message) {
                possibleIdeas.splice(i, 1)
            }
        }
    }

    //Selecting a random idea from all possible ideas and then adding it to used ideas
    let randomIdea = possibleIdeas[Math.floor(Math.random() * possibleIdeas.length)]
    awsFuncs.addToUsedTable(randomIdea.message, randomIdea.screen_name)

    getStory(randomIdea.message, randomIdea.screen_name)

}

let respondToMessages = async () => {
    let possibleIdeas = []
    for (let i = 0; i < messagesReceived.length; i++) {
        //If latest message sent was not from bot... needs a response
        if (messagesReceived[i].conversation[0].sender != myTwitterKey) {
            let username = {
                name: '',
                screen_name: ''
            };
            //Getting the username and screen name
            await Twitter.get('users/show', {
                user_id: messagesReceived[i].userId
            }).then(response => {
                username = {
                    name: response.name,
                    screen_name: response.screen_name
                }
            }).catch(err => {
                console.log('error finding user info: ')
                console.log(err)
            })

            //Determing what to response
            let responseMessage = ''
            if (messagesReceived[i].conversation[0].message.length < 150) {
                responseMessage = `Hi ${username.name}! Try making your idea a little bit longer. It'll help me make the best story possible :)`
            } else {
                responseMessage = `Hi ${username.name}, Thanks for the submission! Your idea might just get turned into a story 🚀 🚀 🚀 `
                possibleIdeas.push({
                    message: messagesReceived[i].conversation[0].message,
                    screen_name: username.screen_name
                })
            }

            //Response
            T.post('direct_messages/events/new', {
                event: {
                    type: "message_create",
                    message_create: {
                        target: {
                            recipient_id: messagesReceived[i].userId
                        },
                        message_data: {
                            text: responseMessage
                        }
                    }
                }
            }).then(response => {
                
            }).catch(err => {
                console.log('error sending message: ')
                console.log(err)
            })
        }
    }

    useIdeas(possibleIdeas)
}

let start = async () => {
    await Promise.all([
        getMessagesFromDB(),
        getMessagesFromTwitter()
    ])
    respondToMessages()

     //7200000 2 hours
}

setTimeout(start, 500000);
