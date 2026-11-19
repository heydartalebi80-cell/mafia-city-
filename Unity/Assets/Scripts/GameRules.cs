
using System;
using System.Collections.Generic;

namespace MafiaCity
{
    public enum PlayerRole
    {
        Citizen,
        Mafia,
        Doctor,
        Detective
    }

    public enum GamePhase
    {
        Lobby,
        RoleReveal,
        Night,
        Discussion,
        Voting,
        Results
    }

    [Serializable]
    public class PlayerData
    {
        public string PlayerId;
        public string DisplayName;
        public PlayerRole Role;
        public bool IsAlive = true;
    }

    public static class RoomRules
    {
        public static readonly int[] SupportedRoomSizes =
        {
            6, 8, 10
        };

        public static bool IsSupportedRoomSize(int count)
        {
            foreach (int size in SupportedRoomSizes)
            {
                if (size == count)
                    return true;
            }

            return false;
        }

        public static List<PlayerRole> CreateRoles(int count)
        {
            if (!IsSupportedRoomSize(count))
                throw new ArgumentOutOfRangeException(
                    nameof(count),
                    "Room size must be 6, 8, or 10."
                );

            var roles = new List<PlayerRole>();

            int mafiaCount = count == 6 ? 2 : 3;

            for (int i = 0; i < mafiaCount; i++)
                roles.Add(PlayerRole.Mafia);

            roles.Add(PlayerRole.Doctor);
            roles.Add(PlayerRole.Detective);

            while (roles.Count < count)
                roles.Add(PlayerRole.Citizen);

            return roles;
        }
    }
}
