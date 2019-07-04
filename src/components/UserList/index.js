import React from 'react'
import style from './index.module.css'

export const UserList = ({ room, current, createConvo, removeUser }) => (
  <ul className={style.component}>
    {Object.keys(room.users).map(userKey=> room.users[userKey]).map(user => (
      <li
        key={user.id}
        className={user.presence.state === 'online' ? style.online : null}
        onClick={e => createConvo({ user })}
        style={{ order: user.presence.state === 'online' && -1 }}
      >
        <img src={user.avatarURL} alt={user.name} />
        <p>{user.name}</p>
      </li>
    ))}
    {
      room.users.length < 5 ? (
        <li className={style.hint} >
          <div>
            Type <span>/invite &lt;username&gt;</span> to invite
        </div>
        </li>
      ) : null
    }
  </ul>
)
