import './StarHeader.css';

const StarHeader = ({ star, setShowVidEditModal, setShowVidAddModal }) => {
  return (
    <div className="star-header">
        <div className="star-text-info">
          <img src={`${process.env.PUBLIC_URL}/images/amy_anderson.png`} alt="amy" className="star-name-icon" />
          <h1>{star.Name}</h1>
        </div>
      <div className="button-group">
        <button className="add-favorite-btn" onClick={() => setShowVidAddModal(true)}>
          Add Video 📺
        </button>
        <button className="add-favorite-btn" onClick={() => setShowVidEditModal(true)}>
          Edit Star ✂️
        </button>
      </div>
    </div>
  );
};

export default StarHeader;