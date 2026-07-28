import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronDown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SidebarItem({
  item,
  isActive,
  isExpanded,
  onToggleSubmenu,
  onCloseSidebar,
  isShortcut,
  onAddShortcut,
  onRemoveShortcut,
  IconComponent,
  currentPageName
}) {
  const handleStarClick = (e, targetItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isShortcut(targetItem.page)) {
      onRemoveShortcut(targetItem.page);
    } else {
      onAddShortcut(targetItem);
    }
  };

  return (
    <div>
      {item.submenu ? (
        <button
          onClick={() => onToggleSubmenu()}
          aria-expanded={isExpanded}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-100",
            isActive
              ? "bg-blue-600 text-white shadow-md"
              : "text-gray-700 hover:bg-slate-100"
          )}
        >
          <div className="flex items-center gap-3">
            {typeof IconComponent === 'function' && <IconComponent className="w-5 h-5" />}
            <span className="font-medium text-sm">{item.name}</span>
          </div>
          <ChevronDown
            className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")}
          />
        </button>
      ) : (
        <div className="group relative">
          <Link
            to={createPageUrl(item.page)}
            onClick={onCloseSidebar}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-100",
              isActive
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-700 hover:bg-slate-100"
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              {typeof IconComponent === 'function' && <IconComponent className="w-5 h-5" />}
              <span className="font-medium text-sm">{item.name}</span>
            </div>
            {item.shortcutable !== false && (
              <button
                onClick={(e) => handleStarClick(e, item)}
                className="p-1 hover:scale-110 transition-transform ml-2"
                title={isShortcut(item.page) ? "Remover atalho" : "Adicionar atalho"}
              >
                <Star
                  className={cn(
                    "w-4 h-4",
                    isShortcut(item.page) ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
                  )}
                />
              </button>
            )}
          </Link>
        </div>
      )}

      {/* Submenu */}
      {item.submenu && isExpanded && (
        <div className="ml-8 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-3">
          {item.submenu
            .filter((sub) => sub.visivel !== false)
            .map((subItem) => {
              const isSubActive = currentPageName === subItem.page;
              return (
                <div key={subItem.page} className="group relative">
                  <Link
                    to={createPageUrl(subItem.page)}
                    onClick={onCloseSidebar}
                    aria-current={isSubActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-100",
                      isSubActive
                        ? "bg-blue-50 text-blue-600 font-medium border-l-2 border-blue-600 -ml-[2px]"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <span className="flex-1">{subItem.name}</span>
                    {subItem.shortcutable !== false && (
                      <button
                        onClick={(e) => handleStarClick(e, subItem)}
                        className="p-1 hover:scale-110 transition-transform ml-2"
                        title={isShortcut(subItem.page) ? "Remover atalho" : "Adicionar atalho"}
                      >
                        <Star
                          className={cn(
                            "w-3 h-3",
                            isShortcut(subItem.page) ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
                          )}
                        />
                      </button>
                    )}
                  </Link>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}