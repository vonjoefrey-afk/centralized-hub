import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  TEAM_LEADER: 'team_leader',
  TEAM_MEMBER: 'team_member'
};

// Sign in with email and password
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      return {
        uid: user.uid,
        email: user.email,
        role: userDoc.data().role,
        displayName: userDoc.data().displayName,
        teamId: userDoc.data().teamId
      };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Create user with email and password
export const signUp = async (email, password, displayName, role = USER_ROLES.TEAM_MEMBER) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      displayName,
      role,
      createdAt: new Date(),
      teamId: null
    });
    
    return {
      uid: user.uid,
      email: user.email,
      role,
      displayName,
      teamId: null
    };
  } catch (error) {
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

// Auth state change listener
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          callback({
            uid: user.uid,
            email: user.email,
            role: userDoc.data().role,
            displayName: userDoc.data().displayName,
            teamId: userDoc.data().teamId
          });
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};
