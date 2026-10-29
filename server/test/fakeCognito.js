// A tiny in-memory Cognito: same commands the real one answers, no network. Used by server and client tests.
export function fakeCognito() {
  const users = new Map(); // email -> { sub, name, password, confirmed, code, groups:Set }
  let n = 0;
  const jwt = (u, groups) => `h.${Buffer.from(JSON.stringify({ sub: u.sub, email: u.email, name: u.name, 'cognito:groups': [...groups] })).toString('base64url')}.s`;
  const err = (name) => Object.assign(new Error(name), { name });
  const client = {
    calls: [],
    async send(cmd) {
      const t = cmd.constructor.name;
      const i = cmd.input;
      client.calls.push(t);
      const u = users.get(i.Username);
      switch (t) {
        case 'SignUpCommand': {
          if (users.has(i.Username)) throw err('UsernameExistsException');
          if (!/\d/.test(i.Password)) throw err('InvalidPasswordException');
          const attrs = Object.fromEntries(i.UserAttributes.map((a) => [a.Name, a.Value]));
          users.set(i.Username, { sub: `aaaaaaaa-0000-0000-0000-00000000000${++n}`, email: attrs.email, name: attrs.name, password: i.Password, confirmed: false, code: '123456', groups: new Set(), created: new Date() });
          return {};
        }
        case 'ConfirmSignUpCommand':
          if (!u) throw err('UserNotFoundException');
          if (i.ConfirmationCode !== u.code) throw err('CodeMismatchException');
          u.confirmed = true; return {};
        case 'InitiateAuthCommand': {
          if (i.AuthFlow === 'REFRESH_TOKEN_AUTH') {
            const e = [...users.values()].find((x) => `r-${x.sub}` === i.AuthParameters.REFRESH_TOKEN);
            if (!e) throw err('NotAuthorizedException');
            return { AuthenticationResult: { IdToken: jwt(e, e.groups) } };
          }
          const x = users.get(i.AuthParameters.USERNAME);
          if (!x || x.password !== i.AuthParameters.PASSWORD) throw err('NotAuthorizedException');
          if (!x.confirmed) throw err('UserNotConfirmedException');
          return { AuthenticationResult: { IdToken: jwt(x, x.groups), RefreshToken: `r-${x.sub}` } };
        }
        case 'ForgotPasswordCommand': if (!u) throw err('UserNotFoundException'); u.code = '654321'; return {};
        case 'ConfirmForgotPasswordCommand':
          if (!u) throw err('UserNotFoundException');
          if (i.ConfirmationCode !== u.code) throw err('CodeMismatchException');
          u.password = i.Password; return {};
        case 'AdminAddUserToGroupCommand': u.groups.add(i.GroupName); return {};
        case 'AdminRemoveUserFromGroupCommand': u.groups.delete(i.GroupName); return {};
        case 'AdminListGroupsForUserCommand': return { Groups: [...u.groups].map((g) => ({ GroupName: g })) };
        case 'ListUsersCommand': {
          const all = [...users.entries()].map(([name, x]) => ({ Username: name, UserCreateDate: x.created, Attributes: [{ Name: 'sub', Value: x.sub }, { Name: 'email', Value: x.email }, { Name: 'name', Value: x.name }] }));
          const m = /sub = "(.*)"/.exec(i.Filter || '');
          return { Users: m ? all.filter((a) => a.Attributes[0].Value === m[1]) : all };
        }
        default: throw new Error(`unexpected ${t}`);
      }
    },
  };
  const verifier = { async verify(token) {
    if (!/^h\..+\.s$/.test(token)) throw new Error('bad token');
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  } };
  return { client, verifier, users };
}

