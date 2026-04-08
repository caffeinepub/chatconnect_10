import Map "mo:core/Map";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Time "mo:core/Time";

module {
  // ---- Old types (from previous deployment's accessControlState) ----
  type OldUserRole = { #admin; #user; #guest };

  type OldAccessControlState = {
    var adminAssigned : Bool;
    userRoles : Map.Map<Principal, OldUserRole>;
  };

  // ---- New AccessControlState (matches AccessControl.mo) ----
  type NewAccessControlState = {
    admins : Set.Set<Principal>;
    users : Set.Set<Principal>;
  };

  // ---- Migration input: only the fields that changed shape ----
  type OldActor = {
    accessControlState : OldAccessControlState;
  };

  // ---- Migration output: new shape for accessControlState ----
  type NewActor = {
    accessControlState : NewAccessControlState;
  };

  public func run(old : OldActor) : NewActor {
    let admins = Set.empty<Principal>();
    let users = Set.empty<Principal>();
    for ((principal, role) in old.accessControlState.userRoles.entries()) {
      switch (role) {
        case (#admin) { admins.add(principal) };
        case (#user) { users.add(principal) };
        case (#guest) { /* no-op: guests are not stored */ };
      };
    };
    {
      accessControlState = { admins; users };
    };
  };
};
