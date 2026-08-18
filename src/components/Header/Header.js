import { useNavigate } from 'react-router-dom';
import './Header.css';

const Header = ({ onAddStar, onSignOut, onSync, onFetchData }) => {
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="logo">BigAndBig</div>
      <div className="header-buttons">
        <button onClick={() => navigate('/')} className="header-btn home-btn"></button>
        <button onClick={() => navigate('/videos')} className="header-btn videos-btn">Videos</button>
        <button onClick={() => navigate('/category')} className="header-btn category-btn">Category</button>
        <button onClick={() => navigate('/youtube')} className="header-btn insta-btn">Youtube</button>
        <button onClick={() => navigate('/gallery')} className="header-btn insta-btn">Gallery</button>
        <button onClick={() => navigate('/updates')} className="header-btn updates-btn">Updates</button>
        <button onClick={onAddStar} className="header-btn add-star-btn">Add Star</button>
        <button onClick={onFetchData} className="header-btn fetch-btn"></button>
        <button onClick={onSync} className="header-btn sync-btn"></button>
        <button onClick={onSignOut} className="header-btn signout-btn"></button>
      </div>
    </header>
  );
};

export default Header;