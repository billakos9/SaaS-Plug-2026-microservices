const AccountDashboard = ({ user }) => (
  <div className="account-dashboard">
    <header>
      <h2>Account Dashboard</h2>
    </header>

    <section>
      <header>
        <h3>User Information</h3>
      </header>
      <p><strong>User ID:</strong> {user?.userInfoId ?? user?.id ?? '—'}</p>
      <p><strong>Username:</strong> {user?.username ?? '—'}</p>
      <p><strong>Email:</strong> {user?.email ?? '—'}</p>
      <p><strong>Phone:</strong> {user?.phoneNumber ?? '—'}</p>
      <p><strong>First name:</strong> {user?.firstName ?? '—'}</p>
      <p><strong>Last name:</strong> {user?.lastName ?? '—'}</p>
      <p><strong>Birthdate:</strong> {user?.birthdate ?? '—'}</p>
      <p><strong>Profile photo:</strong> {user?.profilePhoto ?? '—'}</p>
    </section>

    <section>
      <header>
        <h3>Support &amp; Help</h3>
      </header>
      <p>
        Need assistance? Contact <a href="mailto:support@ionos.app">support@ionos.app</a> or visit our Help Center.
      </p>
    </section>
  </div>
);

export default AccountDashboard;
