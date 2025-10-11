import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Teams collection functions
export const createTeam = async (teamName, teamLeaderId, description = '') => {
  try {
    const teamData = {
      name: teamName,
      teamLeaderId,
      description,
      createdAt: serverTimestamp(),
      members: [teamLeaderId]
    };
    
    const docRef = await addDoc(collection(db, 'teams'), teamData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const getTeam = async (teamId) => {
  try {
    const teamDoc = await getDoc(doc(db, 'teams', teamId));
    if (teamDoc.exists()) {
      return { id: teamDoc.id, ...teamDoc.data() };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

export const getTeamsByLeader = async (teamLeaderId) => {
  try {
    const q = query(
      collection(db, 'teams'),
      where('teamLeaderId', '==', teamLeaderId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};

// Updates collection functions
export const createUpdate = async (teamId, title, content, createdBy) => {
  try {
    const updateData = {
      teamId,
      title,
      content,
      createdBy,
      createdAt: serverTimestamp(),
      status: 'pending'
    };
    
    const docRef = await addDoc(collection(db, 'updates'), updateData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const getUpdatesByTeam = async (teamId) => {
  try {
    const q = query(
      collection(db, 'updates'),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};

// Acknowledgments collection functions
export const acknowledgeUpdate = async (updateId, userId, comment = '') => {
  try {
    const ackData = {
      updateId,
      userId,
      comment,
      acknowledgedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'acknowledgments'), ackData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const getAcknowledgmentStatus = async (updateId) => {
  try {
    const q = query(
      collection(db, 'acknowledgments'),
      where('updateId', '==', updateId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};

export const getUserAcknowledgment = async (updateId, userId) => {
  try {
    const q = query(
      collection(db, 'acknowledgments'),
      where('updateId', '==', updateId),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// User management functions
export const updateUserRole = async (userId, newRole) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      role: newRole,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

export const addUserToTeam = async (userId, teamId) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      teamId,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

export const getAllUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};
