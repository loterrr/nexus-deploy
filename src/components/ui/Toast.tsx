export function Toast({ message, type }: { message: string; type: 'error' | 'success' | 'info' }) {
    return (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg ${type === 'error' ? 'bg-red-500' :
                type === 'success' ? 'bg-green-500' :
                    'bg-blue-500'
            } text-white`}>
            {message}
        </div>
    );
}