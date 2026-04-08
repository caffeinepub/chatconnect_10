import Set "mo:core/Set";
import Principal "mo:core/Principal";

module {
  public type UserRole = { #admin; #user; #guest };
  public type AccessControlState = {
    admins : Set.Set<Principal>;
    users : Set.Set<Principal>;
  };

  public func initState() : AccessControlState {
    { admins = Set.empty<Principal>(); users = Set.empty<Principal>() }
  };

  public func getUserRole(state : AccessControlState, caller : Principal) : UserRole {
    if (state.admins.contains(caller)) { #admin }
    else if (state.users.contains(caller)) { #user }
    else { #guest }
  };

  public func isAdmin(state : AccessControlState, caller : Principal) : Bool {
    state.admins.contains(caller)
  };

  public func hasPermission(state : AccessControlState, caller : Principal, role : UserRole) : Bool {
    switch (role) {
      case (#admin) { isAdmin(state, caller) };
      case (#user) { state.users.contains(caller) or isAdmin(state, caller) };
      case (#guest) { true };
    }
  };

  public func assignRole(state : AccessControlState, _caller : Principal, user : Principal, role : UserRole) {
    switch (role) {
      case (#admin) { state.admins.add(user) };
      case (#user) { state.users.add(user); state.admins.remove(user) };
      case (#guest) { state.users.remove(user); state.admins.remove(user) };
    }
  };
};
