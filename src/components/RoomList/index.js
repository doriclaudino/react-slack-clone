import React from 'react'
import style from './index.module.css'
import { dots } from '../TypingIndicator/index.module.css'

const Icon = id => (
  <svg>
    <use xlinkHref={`index.svg#${id}`} />
  </svg>
)

const unreads = (user, room, messages = {}) => {
  const read = user.readCursor({ roomId: room.id })
  return (
    (read && Object.keys(messages).filter(x => x > read.position).length) ||
    undefined
  )
}

const priority = (user, room, messages = {}) => {
  const unreadMessages = 1//unreads(user, room, messages) || 0
  const lastMessage = Object.keys(messages).pop() || 0
  return (10 * unreadMessages + parseInt(lastMessage)) * -1
}

export const RoomList = ({
  rooms = [],
  user,
  messages,
  current,
  typing,
  actions,
}) => (
  <ul className={style.component}>
    {Object.keys(rooms).map(key=> rooms[key]).map(room => {
      const messageKeys = Object.keys(messages[room.id] || {})
      const latestMessage =
        messageKeys.length > 0 && messages[room.id][messageKeys.pop()]
      const firstUser = Object.keys(room.users).find(key => key !== user.id)
      const order = -1
      const unreadCount = 0 //unreads(user, room, messages[room.id])
      return (
        <li
          key={room.id}
          disabled={room.id === current.id}
          onClick={e => actions.joinRoom(room)}
          style={{ order }}
        >
          {room.name.match(user.id) && firstUser ? (
            <img src={firstUser.avatarURL} alt={firstUser.id} />
          ) : (
            Icon(room.isPrivate ? 'lock' : 'public')
          )}
          <col->
            <p>{room.name.replace(user.id, '')}</p>
            <span>{latestMessage && latestMessage.text}</span>
          </col->
          {room.id !== current.id && unreadCount ? (
            <label>{unreadCount}</label>
          ) : Object.keys(typing[room.id] || {}).length > 0 ? (
            <div className={dots}>
              {[0, 1, 2].map(x => (
                <div key={x} />
              ))}
            </div>
          ) : null}
        </li>
      )
    })}
  </ul>
)
