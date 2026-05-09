import { useState, useRef, useEffect } from "react";
import { Trash2, AlertTriangle, X, Check } from "lucide-react";
import "./AdminSharedUI.css";

export function DeleteConfirmButton({ onConfirm, title = "Delete", disabled = false, className = "" }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsConfirming(false);
      }
    }
    if (isConfirming) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isConfirming]);

  if (isConfirming) {
    return (
      <div className="ap-delete-confirm-group" ref={containerRef}>
        <span className="ap-delete-confirm-msg">
          <AlertTriangle size={14} className="ap-text-warning" /> Are you sure?
        </span>
        <button
          type="button"
          disabled={disabled}
          className="ap-delete-confirm-btn ap-delete-confirm-btn--yes"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
            setIsConfirming(false);
          }}
          title="Yes, delete it"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          disabled={disabled}
          className="ap-delete-confirm-btn ap-delete-confirm-btn--no"
          onClick={(e) => {
            e.stopPropagation();
            setIsConfirming(false);
          }}
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`ap-curriculum-panel__icon-btn ap-curriculum-panel__icon-btn--danger ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        setIsConfirming(true);
      }}
      disabled={disabled}
      title={title}
    >
      <Trash2 size={16} />
    </button>
  );
}