// // a temporary placeholder for the blockchain watcher

// import { UUID } from '../../models/strings'
// import { TOKEN_TYPE } from '../../models/tokenType'
// import Database from '../db'
// import { examplestate, Match2State } from '../../models'

// const db = new Database()

// const typeToTable = (tokenType: TOKEN_TYPE) => {
//   switch (tokenType) {
//     case 'DEMAND':
//       return 'demand'
//     case 'example':
//       return 'example'
//   }
// }

// export const observeTokenId = async (
//   tokenType: TOKEN_TYPE,
//   localId: UUID,
//   state: examplestate | Match2State,
//   tokenId: number,
//   isNewEntity: boolean
// ) => {
//   await db.updateLocalWithTokenId(typeToTable(tokenType), localId, state, tokenId, isNewEntity)
// }
