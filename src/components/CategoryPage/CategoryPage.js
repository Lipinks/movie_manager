import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryDialog from './CategoryDialog';
import * as tagService from '../../services/tagService';
import './CategoryPage.css';

/**
 * One card per category, each linking to the videos page already filtered by
 * that category, plus an edit affordance that opens category management.
 *
 * The filtering itself is not reimplemented here: the card navigates to
 * `/videos?tag=…`, which is the same `selectedTag` the sidebar "Filter by
 * Category" dropdown drives, so both routes end up in identical state.
 */

const CategoryCard = ({ category, onOpen, onEdit }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = category.imageUrl && !imageFailed;

  return (
    <div className="media-card category-card">
      {/* The opener is its own button so the edit control can be a sibling
          rather than an invalid nested button. */}
      <button type="button" className="category-card-open" onClick={() => onOpen(category.name)}>
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

      <div className="card-actions">
        <button
          type="button"
          className="action-btn edit-btn"
          onClick={() => onEdit(category.name)}
          title={`Edit ${category.name}`}
          aria-label={`Edit category ${category.name}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

const CategoryPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(() => tagService.getCategories());
  const [editing, setEditing] = useState(null);

  const refresh = useCallback(() => setCategories(tagService.getCategories()), []);

  const openCategory = (name) => navigate(`/videos?tag=${encodeURIComponent(name)}`);

  return (
    <div className="category-page">
      <h1 className="category-page-title">Categories</h1>

      {categories.length === 0 ? (
        <p className="no-data">No categories yet — tag a video to create one.</p>
      ) : (
        <div className="card-grid">
          {categories.map((category) => (
            <CategoryCard
              key={category.name}
              category={category}
              onOpen={openCategory}
              onEdit={setEditing}
            />
          ))}
        </div>
      )}

      {editing && (
        <CategoryDialog
          key={editing}
          categoryName={editing}
          onClose={() => setEditing(null)}
          onChanged={refresh}
          onDeleted={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

export default CategoryPage;
