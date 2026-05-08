import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface PresenceState {
  /** Set of currently online userIds, stored as a record for cheap lookup. */
  online: Record<string, true>;
}

const initialState: PresenceState = { online: {} };

export const presenceSlice = createSlice({
  name: "presence",
  initialState,
  reducers: {
    presenceSnapshot(state, action: PayloadAction<{ userIds: string[] }>) {
      state.online = {};
      for (const id of action.payload.userIds) state.online[id] = true;
    },
    presenceOnline(state, action: PayloadAction<{ userId: string }>) {
      state.online[action.payload.userId] = true;
    },
    presenceOffline(state, action: PayloadAction<{ userId: string }>) {
      delete state.online[action.payload.userId];
    },
    presenceCleared(state) {
      state.online = {};
    },
  },
});

export const {
  presenceSnapshot,
  presenceOnline,
  presenceOffline,
  presenceCleared,
} = presenceSlice.actions;
