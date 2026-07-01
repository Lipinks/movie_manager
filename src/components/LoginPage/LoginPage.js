import "./LoginPage.css";
  
const LoginPage = ({handleAuth}) => {

  return (
    <div className="home-container">
      <h1>Welcome to Heaven's Door</h1>
      <button onClick={handleAuth} className="signin-btn">
        Sign in with Google
      </button>
    </div>
  );
}

export default LoginPage;