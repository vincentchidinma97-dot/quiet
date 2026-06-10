// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title  VaultRoomRegistry
 * @notice Records private trading room parameters on-chain.
 *         Entry requirements are tamper-proof — no Vault server can override them.
 *
 * @dev    Room creation costs ROOM_CREATION_FEE ETH (anti-spam + protocol revenue).
 *         Entry verification is a read-only on-chain balance check — gasless via staticcall.
 */
contract VaultRoomRegistry is Ownable, ReentrancyGuard {

    // ── Types ─────────────────────────────────────────────────────────────────

    struct Room {
        string  name;
        address creator;
        uint256 minEthRequired;   // wei
        address requiredToken;    // address(0) = no token requirement
        uint256 requiredTokenAmt; // min token balance in smallest unit
        uint32  maxMembers;
        uint32  memberCount;
        bool    isActive;
        bool    isInviteOnly;
        uint256 createdAt;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    uint256 public constant ROOM_CREATION_FEE = 0.01 ether;
    address public immutable treasury;

    uint256 private _nextRoomId = 1;
    mapping(uint256 => Room)    public rooms;
    mapping(uint256 => mapping(address => bool)) public invites;
    mapping(uint256 => mapping(address => bool)) public members;

    // ── Events ────────────────────────────────────────────────────────────────

    event RoomCreated(
        uint256 indexed roomId,
        address indexed creator,
        string name,
        uint256 minEthRequired,
        address requiredToken,
        uint32 maxMembers,
        bool isInviteOnly
    );

    event MemberJoined(uint256 indexed roomId, address indexed member);
    event InviteSent(uint256 indexed roomId, address indexed invitee, address indexed inviter);
    event RoomDeactivated(uint256 indexed roomId);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "VaultRoomRegistry: zero treasury");
        treasury = _treasury;
    }

    // ── Room creation ─────────────────────────────────────────────────────────

    /**
     * @notice Create a new private trading room.
     * @param  name             Display name (max 50 chars)
     * @param  minEthRequired   Minimum ETH balance in wei (0 = no requirement)
     * @param  requiredToken    ERC-20 token address (address(0) = none)
     * @param  requiredTokenAmt Minimum token balance
     * @param  maxMembers       Maximum room size
     * @param  isInviteOnly     If true, entry requires an invite in addition to balance check
     * @return roomId           The new room's on-chain ID
     */
    function createRoom(
        string calldata name,
        uint256 minEthRequired,
        address requiredToken,
        uint256 requiredTokenAmt,
        uint32 maxMembers,
        bool isInviteOnly
    ) external payable nonReentrant returns (uint256 roomId) {
        require(msg.value == ROOM_CREATION_FEE, "VaultRoomRegistry: wrong fee");
        require(bytes(name).length > 0 && bytes(name).length <= 50, "VaultRoomRegistry: invalid name");
        require(maxMembers >= 2 && maxMembers <= 1000, "VaultRoomRegistry: invalid size");

        // Forward fee to treasury
        (bool ok,) = payable(treasury).call{value: msg.value}("");
        require(ok, "VaultRoomRegistry: treasury transfer failed");

        roomId = _nextRoomId++;

        rooms[roomId] = Room({
            name:             name,
            creator:          msg.sender,
            minEthRequired:   minEthRequired,
            requiredToken:    requiredToken,
            requiredTokenAmt: requiredTokenAmt,
            maxMembers:       maxMembers,
            memberCount:      1,   // creator auto-joins
            isActive:         true,
            isInviteOnly:     isInviteOnly,
            createdAt:        block.timestamp
        });

        members[roomId][msg.sender] = true;

        emit RoomCreated(
            roomId, msg.sender, name,
            minEthRequired, requiredToken, maxMembers, isInviteOnly
        );
    }

    // ── Entry verification ────────────────────────────────────────────────────

    /**
     * @notice Check whether a wallet can enter a room.
     *         Pure on-chain verification — no server involvement.
     * @return canEnter  True if all requirements are met
     * @return reason    Human-readable failure reason (empty if canEnter)
     */
    function verifyEntry(uint256 roomId, address wallet)
        external
        view
        returns (bool canEnter, string memory reason)
    {
        Room storage room = rooms[roomId];

        if (!room.isActive)
            return (false, "room is inactive");

        if (members[roomId][wallet])
            return (true, "already a member");

        if (room.memberCount >= room.maxMembers)
            return (false, "room is full");

        if (room.isInviteOnly && !invites[roomId][wallet])
            return (false, "invite required");

        if (room.minEthRequired > 0 && wallet.balance < room.minEthRequired)
            return (false, "insufficient ETH balance");

        if (room.requiredToken != address(0)) {
            // Call balanceOf via low-level call to avoid reverting on non-ERC20
            (bool ok, bytes memory data) = room.requiredToken.staticcall(
                abi.encodeWithSignature("balanceOf(address)", wallet)
            );
            if (!ok) return (false, "token check failed");
            uint256 balance = abi.decode(data, (uint256));
            if (balance < room.requiredTokenAmt)
                return (false, "insufficient token balance");
        }

        return (true, "");
    }

    // ── Membership ────────────────────────────────────────────────────────────

    function joinRoom(uint256 roomId) external nonReentrant {
        (bool canEnter, string memory reason) = this.verifyEntry(roomId, msg.sender);
        require(canEnter, string.concat("VaultRoomRegistry: ", reason));

        rooms[roomId].memberCount++;
        members[roomId][msg.sender] = true;

        emit MemberJoined(roomId, msg.sender);
    }

    function sendInvite(uint256 roomId, address invitee) external {
        require(members[roomId][msg.sender], "VaultRoomRegistry: not a member");
        require(!members[roomId][invitee], "VaultRoomRegistry: already a member");
        invites[roomId][invitee] = true;
        emit InviteSent(roomId, invitee, msg.sender);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function deactivateRoom(uint256 roomId) external {
        require(
            msg.sender == rooms[roomId].creator || msg.sender == owner(),
            "VaultRoomRegistry: not authorised"
        );
        rooms[roomId].isActive = false;
        emit RoomDeactivated(roomId);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getRoom(uint256 roomId) external view returns (Room memory) {
        return rooms[roomId];
    }

    function isMember(uint256 roomId, address wallet) external view returns (bool) {
        return members[roomId][wallet];
    }

    function totalRooms() external view returns (uint256) {
        return _nextRoomId - 1;
    }
}
