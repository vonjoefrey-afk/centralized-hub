import React from 'react';
import { 
  TrashIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  BellIcon,
  EyeIcon,
  ArrowPathIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import { Badge, Button } from '../ui';
import { renderContentWithLinks } from '../../utils/text';
import clsx from 'clsx';

/**
 * Premium Update Card Component
 * Unified for Team Member, Team Leader, Trainer, and Admin dashboards.
 */
const UpdateCard = ({
    update,
    isManagerView = false,
    isAcknowledged = false,
    acknowledgmentDate = null,
    statusBreakdown = {},
    onViewDetails,
    onAcknowledge,
    onBumpUsers,
    onEdit,
    onDelete,
    className
}) => {
    // Determine deadline status
    const deadline = update.deadline?.toDate ? update.deadline.toDate() : (update.deadline ? new Date(update.deadline) : null);
    const isOverdue = deadline && deadline < new Date();
    
    // Get breakdown data
    const breakdown = statusBreakdown?.[update.id] || update.breakdown || {
        acknowledgedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        total: 0
    };

    const pendingCount = breakdown.pendingCount || breakdown.pending?.length || 0;
    const acknowledgedCount = breakdown.acknowledgedCount || breakdown.acknowledged?.length || 0;

    return (
        <div 
            className={clsx(
                "group relative overflow-hidden transition-all duration-300",
                "bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-md",
                "border border-gray-100 dark:border-white/10 rounded-2xl",
                "hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-white/5",
                "hover:-translate-y-0.5",
                className
            )}
            data-update-id={update.id}
        >
            {/* Top accent gradient line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="p-6">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {isOverdue && !isAcknowledged && (
                                <Badge variant="error" size="sm" className="animate-pulse">URGENT</Badge>
                            )}
                            {(!isAcknowledged && !isManagerView) && (
                                <Badge variant="primary" size="sm">NEW</Badge>
                            )}
                            {update.type === 'trainer-updates' && (
                                <Badge variant="warning" size="sm">SYSTEM</Badge>
                            )}
                        </div>
                        <h4 className="text-lg font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {update.title}
                        </h4>
                        <div className="flex items-center text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            <ClockIcon className="w-3 h-3 mr-1" />
                            {update.createdAt?.toDate?.()?.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'Recent'}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onViewDetails && (
                            <Button
                                onClick={() => onViewDetails(update)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 !p-0 rounded-xl"
                                title="View Details"
                            >
                                <EyeIcon className="w-4 h-4" />
                            </Button>
                        )}
                        {onEdit && (
                            <Button
                                onClick={() => onEdit(update)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 !p-0 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-500"
                                title="Edit Update"
                            >
                                <PencilSquareIcon className="w-4 h-4" />
                            </Button>
                        )}
                        {onDelete && (
                            <Button
                                onClick={() => onDelete(update)}
                                variant="danger"
                                size="sm"
                                className="h-8 w-8 !p-0 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border-none"
                                title="Delete Update"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Content Section */}
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed whitespace-pre-wrap font-medium">
                    {renderContentWithLinks(update.content)}
                </div>

                {/* Footer Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-gray-100 dark:border-white/5">
                    {/* Left side: Status/Manager Info */}
                    <div className="flex flex-wrap items-center gap-3">
                        {deadline && (
                            <div 
                                className={clsx(
                                    "flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                                    isOverdue 
                                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" 
                                        : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                                )}
                            >
                                <ClockIcon className="w-3.5 h-3.5 mr-1.5" />
                                {isOverdue ? 'Overdue: ' : 'Deadline: '}
                                {deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                        )}

                        {isManagerView && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onViewDetails?.(update, 'acknowledged')}
                                    className="flex items-center px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all"
                                >
                                    <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full mr-2" />
                                    {acknowledgedCount} Acknowledged
                                </button>
                                <button
                                    onClick={() => onViewDetails?.(update, 'pending')}
                                    className="flex items-center px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500 hover:text-white transition-all"
                                >
                                    <span className="w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full mr-2" />
                                    {pendingCount} Pending
                                </button>
                            </div>
                        )}

                        {!isManagerView && isAcknowledged && (
                            <div className="flex items-center px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold">
                                <CheckCircleIcon className="w-3.5 h-3.5 mr-1.5" />
                                Acknowledged {acknowledgmentDate && `on ${acknowledgmentDate}`}
                            </div>
                        )}
                    </div>

                    {/* Right side: Action Buttons */}
                    <div className="flex items-center gap-2">
                        {isManagerView && onBumpUsers && pendingCount > 0 && (
                            <Button
                                onClick={() => onBumpUsers(update.id)}
                                variant="warning"
                                size="sm"
                                className="rounded-xl font-bold text-xs h-9 px-4 gap-1.5 shadow-lg shadow-amber-500/10"
                            >
                                <BellIcon className="w-4 h-4" />
                                Notify Pending
                            </Button>
                        )}

                        {!isManagerView && !isAcknowledged && (
                            <Button
                                onClick={() => onAcknowledge(update.id)}
                                variant="primary"
                                size="sm"
                                className="w-full sm:w-auto rounded-xl font-bold text-xs h-9 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
                            >
                                Acknowledge Now
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdateCard;
