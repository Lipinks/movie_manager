import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as tagService from '../../services/tagService';
import './CategoryPage.css';

/**
 * One card per category, each linking to the videos page already filtered by
 * that category.
 *
 * The filtering itself is not reimplemented here: the card navigates to
 * `/videos?tag=…`, which is the same `selectedTag` the sidebar "Filter by
 * Category" dropdown drives, so both routes end up in identical state.
 */

const CategoryCard = ({ category, onOpen }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = category.imageUrl && !imageFailed;

  return (
    <button type="button" className="media-card category-card" onClick={() => onOpen(category.name)}>
      <div className="media-card-image">
        {showImage ? (
          <img
            src={category.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="media-card-fallback" aria-hidden="true">
            {category.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="category-card-label">{category.name}</div>
    </button>
  );
};

const CategoryPage = () => {
  const navigate = useNavigate();
  const categories = useMemo(() => tagService.getCategories(), []);

  const openCategory = (name) => navigate(`/videos?tag=${encodeURIComponent(name)}`);

  return (
    <div className="category-page">
      <h1 className="category-page-title">Categories</h1>

      {categories.length === 0 ? (
        <p className="no-data">No categories yet — tag a video to create one.</p>
      ) : (
        <div className="card-grid">
          {categories.map((category) => (
            <CategoryCard key={category.name} category={category} onOpen={openCategory} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryPage;
